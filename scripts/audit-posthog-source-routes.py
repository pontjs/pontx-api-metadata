#!/usr/bin/env python3
"""Statically inventory PostHog REST-router registrations from a pinned checkout.

This deliberately does not import Django or generate an OpenAPI document.  It
is only a provenance aid for the PostHog candidate: imports can execute
unavailable ``ee/`` code and a generated hosted document is mutable/unlicensed
for this contribution.
"""

from __future__ import annotations

import argparse
import ast
import json
from pathlib import Path
from typing import Any


ROOT_BASES = {
    "root": "api",
    "projects": "api/projects",
    "organizations": "api/organizations",
}


def as_text(node: ast.AST) -> str:
    try:
        return ast.unparse(node)
    except Exception:
        return "<unparseable>"


def literal_string(node: ast.AST) -> str | None:
    return node.value if isinstance(node, ast.Constant) and isinstance(node.value, str) else None


def dotted_name(node: ast.AST) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        parent = dotted_name(node.value)
        return f"{parent}.{node.attr}" if parent else None
    return None


class RouteCollector(ast.NodeVisitor):
    def __init__(self, source_root: Path, source_file: Path) -> None:
        self.source_root = source_root
        self.source_file = source_file
        self.imports: dict[str, str] = {}
        self.bases: dict[str, str] = {"router": ROOT_BASES["root"]}
        self.registrations: list[dict[str, Any]] = []
        self.ee_condition_depth = 0

    @property
    def relative_file(self) -> str:
        return self.source_file.relative_to(self.source_root).as_posix()

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            self.imports[alias.asname or alias.name.split(".")[0]] = alias.name

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        module = "." * node.level + (node.module or "")
        for alias in node.names:
            self.imports[alias.asname or alias.name] = f"{module}.{alias.name}"

    def visit_If(self, node: ast.If) -> None:
        is_ee_condition = "EE_AVAILABLE" in as_text(node.test)
        self.ee_condition_depth += int(is_ee_condition)
        for statement in node.body:
            self.visit(statement)
        self.ee_condition_depth -= int(is_ee_condition)
        for statement in node.orelse:
            self.visit(statement)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        """Track the common ``if not EE_AVAILABLE: return`` route guard.

        Some product route modules use a guard clause rather than wrapping the
        following registrations in an ``if EE_AVAILABLE`` block.  Once that
        guard returns, the remainder of that function is EE-only at runtime.
        """
        guard_applies_to_remainder = False
        for statement in node.body:
            is_unavailable_guard = (
                isinstance(statement, ast.If)
                and "not EE_AVAILABLE" in as_text(statement.test)
                and any(isinstance(child, ast.Return) for child in ast.walk(statement))
            )
            self.visit(statement)
            if is_unavailable_guard:
                self.ee_condition_depth += 1
                guard_applies_to_remainder = True
        if guard_applies_to_remainder:
            self.ee_condition_depth -= 1

    def visit_Assign(self, node: ast.Assign) -> None:
        call = node.value
        if isinstance(call, ast.Call):
            registration = self.parse_register_call(call)
            if registration is None and dotted_name(call.func) == "routers.add" and len(call.args) >= 2:
                registration = self.parse_register_call(call.args[1]) if isinstance(call.args[1], ast.Call) else None
                if registration is not None:
                    registration["registryAdd"] = literal_string(call.args[0])
            if registration is not None:
                self.record(registration)
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        # The router derives URL parameter names from viewsets at
                        # runtime. ``parents_query_lookups`` is a persistence
                        # mapping, not an authoritative URL template, so the
                        # inventory records only resource route trees.
                        self.bases[target.id] = registration["routeTree"]
        self.generic_visit(node)

    def visit_Expr(self, node: ast.Expr) -> None:
        if isinstance(node.value, ast.Call):
            registration = self.parse_register_call(node.value)
            if registration is not None:
                self.record(registration)
        self.generic_visit(node)

    def parse_register_call(self, call: ast.Call) -> dict[str, Any] | None:
        if not isinstance(call.func, ast.Attribute) or call.func.attr != "register" or not call.args:
            return None
        route = literal_string(call.args[0])
        if route is None:
            return None
        receiver = dotted_name(call.func.value)
        if receiver == "router":
            base = ROOT_BASES["root"]
        elif receiver and receiver.startswith("routers."):
            base = ROOT_BASES.get(receiver.removeprefix("routers."))
        else:
            base = self.bases.get(receiver or "")
        if base is None:
            return None

        view = as_text(call.args[1]) if len(call.args) > 1 else "<missing view>"
        top_symbol = view.split(".", 1)[0]
        resolved_module = self.imports.get(top_symbol, "")
        ee_implementation = resolved_module.startswith("ee.") or self.ee_condition_depth > 0
        lookup = None
        if len(call.args) > 3 and isinstance(call.args[3], (ast.List, ast.Tuple)) and call.args[3].elts:
            lookup = literal_string(call.args[3].elts[-1])

        return {
            "routeTree": f"{base.rstrip('/')}/{route.strip('/')}/",
            "route": route,
            "receiver": receiver,
            "view": view,
            "lookup": lookup,
            "source": self.relative_file,
            "line": call.lineno,
            "provenance": "requires-ee-resolution" if ee_implementation else "root-mit-source",
        }

    def record(self, registration: dict[str, Any]) -> None:
        key = (registration["routeTree"], registration["view"], registration["line"])
        if not any((item["routeTree"], item["view"], item["line"]) == key for item in self.registrations):
            self.registrations.append(registration)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_root", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--revision", required=True)
    args = parser.parse_args()

    source_root = args.source_root.resolve()
    files = [source_root / "posthog/api/rest_router.py", *sorted((source_root / "products").glob("*/backend/routes.py"))]
    registrations: list[dict[str, Any]] = []
    for source_file in files:
        if not source_file.exists():
            continue
        collector = RouteCollector(source_root, source_file)
        collector.visit(ast.parse(source_file.read_text(), filename=str(source_file)))
        registrations.extend(collector.registrations)

    registrations.sort(key=lambda item: (item["routeTree"], item["source"], item["line"]))
    result = {
        "formatVersion": 1,
        "source": {
            "repository": "https://github.com/PostHog/posthog",
            "revision": args.revision,
            "license": "MIT outside ee/; see the candidate evidence ledger",
        },
        "scope": "Static REST-router registration inventory only. routeTree omits runtime-generated lookup segments, so it is not an OpenAPI document or endpoint contract.",
        "counts": {
            "routeRegistrations": len(registrations),
            "rootMitSource": sum(item["provenance"] == "root-mit-source" for item in registrations),
            "requiresEeResolution": sum(item["provenance"] == "requires-ee-resolution" for item in registrations),
        },
        "registrations": registrations,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()

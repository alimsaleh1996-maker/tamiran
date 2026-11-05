#!/usr/bin/env python3
"""Recheck Graphify's exception edges against PHP syntax trees, without running PHP.

Run with the Python interpreter in Graphify's isolated environment (tree-sitter
and tree-sitter-php are its core dependencies). No API, database or network calls.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re
import subprocess

from tree_sitter import Language, Parser
import tree_sitter_php

CALLABLE_TYPES = {"function_definition", "method_declaration", "anonymous_function", "arrow_function"}


def edition(path: str) -> str | None:
    if path.startswith("hosting/"):
        return "php_hosting"
    if path.startswith("migration/worker/baseline/"):
        return "frozen_reference"
    return None


def main() -> int:
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    args.add_argument("--output", type=Path)
    a = args.parse_args()
    root = a.root.resolve()
    graph_path = root / "graphify-out/graph.json"
    graph = json.loads(graph_path.read_text())
    nodes = {n["id"]: n for n in graph["nodes"]}
    targets = {n["id"]: n for n in graph["nodes"] if n.get("label") == "TamiranApiException"}
    if len(targets) != 2:
        raise RuntimeError("Expected two edition-scoped exception definitions; inspect graph before proceeding")
    candidates = [e for e in graph["links"] if e.get("confidence") == "INFERRED" and e["target"] in targets]
    parser = Parser(Language(tree_sitter_php.language_php()))
    documents = {}
    constructors = []
    namespace_files = []
    definitions = []
    parse_warnings = []
    for directory in [root / "hosting", root / "migration/worker/baseline"]:
        for path in sorted(directory.rglob("*.php")):
            name = path.relative_to(root).as_posix()
            content = path.read_bytes()
            tree = parser.parse(content)
            documents[name] = (content, tree)
            if tree.root_node.has_error:
                parse_warnings.append(name)
            stack = [tree.root_node]
            while stack:
                n = stack.pop()
                stack.extend(reversed(n.named_children))
                if n.type in {"namespace_definition", "namespace_use_declaration"}:
                    namespace_files.append(name)
                if n.type == "class_declaration":
                    symbol = n.child_by_field_name("name")
                    if symbol and content[symbol.start_byte:symbol.end_byte] == b"TamiranApiException":
                        definitions.append({"source_file": name, "line": n.start_point.row + 1, "edition": edition(name)})
                if n.type != "object_creation_expression":
                    continue
                if not re.match(rb"new\s+\\?TamiranApiException\b", content[n.start_byte:n.end_byte]):
                    continue
                parent = n.parent
                while parent and parent.type not in CALLABLE_TYPES:
                    parent = parent.parent
                symbol_node = parent.child_by_field_name("name") if parent else None
                symbol = content[symbol_node.start_byte:symbol_node.end_byte].decode() if symbol_node else None
                constructors.append({
                    "source_file": name, "line": n.start_point.row + 1, "column": n.start_point.column + 1,
                    "end_line": n.end_point.row + 1, "edition": edition(name),
                    "scope_line": parent.start_point.row + 1 if parent else None,
                    "scope_type": parent.type if parent else "top_level", "scope_symbol": symbol,
                })
    file_index = defaultdict(list)
    for constructor in constructors:
        file_index[constructor["source_file"]].append(constructor)
    verified = []
    unresolved = []
    for edge in candidates:
        caller = nodes[edge["source"]]
        target = targets[edge["target"]]
        # PHP method display labels currently use '.method()'; compare the
        # callable name after the display qualifier as well as its exact span.
        caller_symbol = re.split(r"::|\.", caller["label"])[-1]
        line = int(re.search(r"\d+", edge.get("source_location", ""))[0])
        scope_line = int(re.search(r"\d+", caller.get("source_location", ""))[0])
        sites = [c for c in file_index[edge["source_file"]]
                 if c["line"] <= line <= c["end_line"] and c["scope_line"] == scope_line
                 and (not c["scope_symbol"] or c["scope_symbol"] + "()" == caller_symbol)]
        same_edition = edition(caller.get("source_file", "")) == edition(target["source_file"])
        namespace_unambiguous = edge["source_file"] not in namespace_files
        valid = bool(sites and same_edition and namespace_unambiguous)
        result = {
            "source": edge["source"], "source_label": caller["label"], "target": edge["target"],
            "edition": edition(edge["source_file"]), "source_file": edge["source_file"],
            "graph_source_location": edge["source_location"], "caller_start_line": scope_line,
            "original_relation": edge["relation"], "original_confidence": edge["confidence"],
            "original_confidence_score": edge.get("confidence_score"),
            "verification": "verified_static_constructor" if valid else "unverified",
            "literal_constructor_sites": sites, "same_edition": same_edition,
            "namespace_unambiguous": namespace_unambiguous,
        }
        (verified if valid else unresolved).append(result)
    covered_scopes = set()
    covered_file_roots = set()
    linked_files = set()
    for e in graph["links"]:
        if e["target"] in targets or e["source"] in targets:
            linked_files.add(e.get("source_file"))
        if e["target"] in targets and e["relation"] == "calls":
            source = nodes[e["source"]]
            if not source.get("_callable"):
                covered_file_roots.add(source.get("source_file"))
            if source.get("source_location"):
                covered_scopes.add((source.get("source_file"), int(re.search(r"\d+", source["source_location"])[0])))
    actual_scopes = {(c["source_file"], c["scope_line"]) for c in constructors if c["scope_line"] is not None}
    missing_scopes = sorted(actual_scopes - covered_scopes)
    top_level = [c for c in constructors if c["scope_line"] is None]
    unmodeled_top_level = [c for c in top_level if c["source_file"] not in covered_file_roots]
    top_level_groups = []
    for name in sorted({c["source_file"] for c in unmodeled_top_level}):
        items = [c for c in unmodeled_top_level if c["source_file"] == name]
        top_level_groups.append({"source_file": name, "edition": edition(name), "constructor_count": len(items),
                                 "locations": [{"line": c["line"], "column": c["column"]} for c in items]})
    bypasses = []
    for name, (content, tree) in documents.items():
        if not name.startswith("hosting/") or name in linked_files:
            continue
        hits = [{"line": number, "text": line.strip()} for number, line in enumerate(content.decode().splitlines(), 1)
                if re.search(r"http_response_code\(|tracking_code|httpStatus", line)]
        if hits:
            category = "web_entrypoint" if name.startswith("hosting/public_html/") else "local_development_or_test"
            bypasses.append({"source_file": name, "category": category, "evidence": hits,
                             "interpretation": "Separate HTTP/error shaping without a graph edge to the exception class; not itself a defect"})
    output = a.output or root / "graphify-out/reviews/tamiran-api-exception.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip()
    record = {
        "source_commit": commit,
        "graph_sha256": hashlib.sha256(graph_path.read_bytes()).hexdigest(),
        "method": "PHP tree-sitter syntax trees: literal class construction, exact call-site line, enclosing callable start/name, same edition and no namespace ambiguity",
        "scope": "Static source verification only; no PHP execution, HTTP, database, customer data or hosted deployment",
        "definitions": definitions, "php_files_parsed": len(documents), "parse_warnings": parse_warnings,
        "inferred_edges_reviewed": len(candidates), "verified": len(verified), "unverified": len(unresolved),
        "verified_by_edition": dict(Counter(r["edition"] for r in verified)),
        "literal_constructor_occurrences": len(constructors), "callable_scopes_with_construction": len(actual_scopes),
        "callable_scopes_represented_in_graph": len(actual_scopes & covered_scopes), "missing_callable_scopes": missing_scopes,
        "top_level_constructor_occurrences": len(top_level), "top_level_file_count": len(top_level_groups),
        "top_level_constructor_occurrences_without_graph_calls": len(unmodeled_top_level),
        "top_level_constructions_not_modeled_as_calls": top_level_groups, "bypasses": bypasses,
        "verified_edges": verified, "unverified_edges": unresolved,
        "source_files_sha256": {name: hashlib.sha256(content).hexdigest() for name, (content, _) in sorted(documents.items())},
    }
    output.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({k: record[k] for k in ["inferred_edges_reviewed", "verified", "unverified", "verified_by_edition",
                                          "php_files_parsed", "parse_warnings", "literal_constructor_occurrences",
                                          "callable_scopes_with_construction", "missing_callable_scopes",
                                          "top_level_constructor_occurrences", "top_level_file_count"]}, ensure_ascii=False))
    return int(bool(unresolved or parse_warnings))


if __name__ == "__main__":
    raise SystemExit(main())

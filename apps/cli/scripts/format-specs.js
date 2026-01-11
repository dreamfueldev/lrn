#!/usr/bin/env node
/**
 * Formats vitest JSON output into a readable spec list.
 * Usage: vitest run --reporter=json | node scripts/format-specs.js
 */

let input = "";

process.stdin.setEncoding("utf8");
process.stdin.on("readable", () => {
  let chunk;
  while ((chunk = process.stdin.read()) !== null) {
    input += chunk;
  }
});

process.stdin.on("end", () => {
  try {
    const results = JSON.parse(input);
    formatResults(results);
  } catch (e) {
    console.error("Failed to parse vitest JSON output:", e.message);
    process.exit(1);
  }
});

function formatResults(results) {
  const { testResults, numTotalTests, numTodoTests } = results;

  console.log("═".repeat(70));
  console.log("  lrn CLI Specification");
  console.log("═".repeat(70));
  console.log();

  // Group tests by file
  const byFile = new Map();

  for (const file of testResults) {
    const fileName = file.name
      .replace(/^.*specs\//, "")
      .replace(/\.spec\.ts$/, "");

    if (!byFile.has(fileName)) {
      byFile.set(fileName, []);
    }

    for (const test of file.assertionResults) {
      byFile.get(fileName).push({
        ancestors: test.ancestorTitles,
        title: test.title,
        status: test.status,
      });
    }
  }

  // Output by file
  let totalTests = 0;
  let todoTests = 0;
  let passedTests = 0;

  for (const [fileName, tests] of byFile) {
    console.log(`┌─ ${fileName}`);
    console.log("│");

    // Build tree structure
    const tree = buildTree(tests);
    printTree(tree, "│  ");

    console.log("│");
    console.log(`└─ ${tests.length} specs`);
    console.log();

    totalTests += tests.length;
    todoTests += tests.filter((t) => t.status === "todo").length;
    passedTests += tests.filter((t) => t.status === "passed").length;
  }

  console.log("═".repeat(70));
  console.log(`  Total: ${totalTests} specs`);
  console.log(`  Todo:  ${todoTests} (pending implementation)`);
  console.log(`  Done:  ${passedTests} (implemented)`);
  console.log("═".repeat(70));
}

function buildTree(tests) {
  const root = { children: new Map(), tests: [] };

  for (const test of tests) {
    let current = root;

    for (const ancestor of test.ancestors) {
      if (!current.children.has(ancestor)) {
        current.children.set(ancestor, { children: new Map(), tests: [] });
      }
      current = current.children.get(ancestor);
    }

    current.tests.push(test);
  }

  return root;
}

function printTree(node, indent) {
  for (const [name, child] of node.children) {
    console.log(`${indent}▸ ${name}`);

    // Print tests at this level
    for (const test of child.tests) {
      const status = test.status === "todo" ? "○" : "●";
      console.log(`${indent}  ${status} ${test.title}`);
    }

    // Recurse into children
    if (child.children.size > 0) {
      printTree(child, indent + "  ");
    }
  }
}

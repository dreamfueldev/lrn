import { query, search } from "@lrn/core";

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case "list":
      console.log("lrn list - not yet implemented");
      break;
    case "show":
      console.log("lrn show - not yet implemented");
      break;
    case "search":
      console.log("lrn search - not yet implemented");
      break;
    case "sync":
      console.log("lrn sync - not yet implemented");
      break;
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

function printHelp() {
  console.log(`
lrn - learn and query programming interfaces

Usage: lrn [command] [options]

Commands:
  list [package]        List available packages or members
  show <package.member> Show details for a specific member
  search <query>        Search across all packages
  sync                  Sync specs for project dependencies

Options:
  --help, -h            Show this help message
  --version, -v         Show version

Examples:
  lrn list              List all cached packages
  lrn list stripe       List Stripe API endpoints
  lrn show stripe.charges.create
  lrn search "authentication"
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

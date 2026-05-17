import { dispatchNotifications } from "./dispatcher";

async function main() {
  const stats = await dispatchNotifications();
  console.log("[notify] dispatch complete", stats);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

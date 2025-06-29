import type { MutationV1 as Mutation } from "replicache";
import type { Route } from "./+types/replicache-push";
import { prisma } from "prisma/db.server";

export async function action({ request }: Route.ActionArgs) {
  const { clientGroupID: clientID, mutations } = await request.json();

  // 1. Get client's current lastMutationID
  const client = await prisma.replicacheClient.findFirst({
    where: { id: clientID },
  });

  if (!client) {
    console.error(`Push from unknown clientID: ${clientID}`);
    return Response.json({ error: "Client not found" });
  }

  let lastMutationID = client.last_mutation_id;
  let nextMutationID = lastMutationID;

  // 2. Process mutations sequentially
  for (const mutation of mutations) {
    const { id, name, args } = mutation;

    // Deduplication: If this mutation has already been processed by the server, skip it.
    // This is crucial for idempotence and robustness.
    if (id <= lastMutationID) {
      console.log(
        `Mutation ${id} from client ${clientID} already processed. Skipping.`
      );
      continue;
    }

    try {
      // Use a Prisma transaction for atomicity for each mutation
      await prisma.$transaction(async (tx) => {
        switch (name) {
          case "createProduct":
            await tx.product.create({
              data: {
                id: args.id,
                name: args.name,
                price: args.price,
                stock: args.stock,
                version: args.version || 1,
              },
            });
            console.log(`Client ${clientID}: Created product ${args.name}`);
            break;

          case "updateProductStock":
            // args: { id, stockChange }
            const currentProduct = await tx.product.findUnique({
              where: { id: args.id },
            });

            if (!currentProduct) {
              console.warn(
                `Client ${clientID}: Product with ID ${args.id} not found for stock update.`
              );
              // In a real app, you might roll back the transaction or log this more seriously.
              // For a single client, this could mean an admin deleted the product.
              break;
            }

            // Apply stock change and increment version
            await tx.product.update({
              where: { id: args.id },
              data: {
                stock: currentProduct.stock + args.stockChange,
                version: currentProduct.version + 1, // Always increment version on update
              },
            });
            console.log(
              `Client ${clientID}: Updated stock for ${
                currentProduct.name
              }. New stock: ${currentProduct.stock + args.stockChange}`
            );
            break;

          // Add more mutation cases as your POS needs (e.g., 'deleteProduct', 'processSale')
          default:
            console.warn(`Client ${clientID}: Unknown mutation: ${name}`);
        }

        // After successfully applying the mutation, update client's last_mutation_id in the database
        // This ensures that if the server crashes, it knows which mutations have been applied.
        await tx.replicacheClient.update({
          where: { id: clientID },
          data: { last_mutation_id: id },
        });
        nextMutationID = id;
      });
    } catch (e) {
      console.error(
        `Client ${clientID}: Error processing mutation ${id} (${name}):`,
        e
      );
      // If an error occurs, you might return an error status to Replicache
      // However, Replicache will retry pushes automatically.
      // The crucial part is that `last_mutation_id` is only updated on success.
      break; // Stop processing further mutations in this push if one fails catastrophically
    }
  }

  // Final update of the client's lastMutationID in case of partial success or early exit
  if (nextMutationID > lastMutationID) {
    await prisma.replicacheClient.update({
      where: { id: clientID },
      data: { last_mutation_id: nextMutationID },
    });
  }

  return new Response("OK", { status: 200 });
}

import { prisma } from "prisma/db.server";
import type { Route } from "./+types/replicache-pull";

export async function action({ request }: Route.ActionArgs) {
  const { clientGroupID: clientID } = await request.json();

  let client = await prisma.replicacheClient.findFirst({
    where: { id: clientID },
  });

  

  const lastMutationID = client.last_mutation_id;

  const products = await prisma.product.findMany({
    orderBy: {
      version: "asc",
    },
  });

  const patch = [
    { op: "clear" },
    ...products.map((p) => ({
      op: "put",
      key: `product/${p.id}`,
      value: p,
    })),
  ];

  const response = {
    lastMutationID: lastMutationID,
    cookie: Date.now(),
    patch: patch,
  };

  console.log(
    `Pull for client ${clientID}: lastMutationID=${lastMutationID}, sending ${products.length} products`
  );
  return response;
}


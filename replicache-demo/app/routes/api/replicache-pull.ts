import { prisma } from "prisma/db.server";
import type { Route } from "./+types/replicache-pull";

export async function action({ request }: Route.ActionArgs) {
  const { clientGroupID: clientID } = await request.json();

  let client = await prisma.replicacheClient.findFirst({
    where: { id: clientID },
  });

  if (!client) {
    client = await prisma.replicacheClient.create({
      data: { id: clientID },
    });
  }

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
      value: {
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock,
        version: p.version,
      },
    })),
  ];

  const response = {
    lastMutationID: lastMutationID,
    cookie: Date.now(),
    patch: patch,
  };

  return Response.json(response);
}

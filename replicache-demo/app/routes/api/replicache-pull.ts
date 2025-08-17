import { prisma } from "prisma/db.server";
import type { Route } from "./+types/replicache-pull";
import type { PatchOperation, PullResponse } from "replicache";

export async function action({ request }: Route.ActionArgs) {
  const body = await request.json();
  console.log("Full request body:", JSON.stringify(body, null, 2));

  // Extract clientID and cookie from request
  const {
    clientGroupID,
    cookie,
    lastMutationID,
    profileID,
    pullVersion,
    schemaVersion,
  } = body;
  const clientID = clientGroupID; // Use clientGroupID as the clientID

  console.log(`Pull from clientID: ${clientID}, cookie: ${cookie}`);

  // Validate that we have a clientID
  if (!clientID) {
    console.error(
      "Missing clientID in request. Available fields:",
      Object.keys(body)
    );
    return Response.json(
      { error: "Missing clientID in request" },
      { status: 400 }
    );
  }

  console.log(
    `Processing pull for clientID: ${clientID}, cookie: ${cookie}, lastMutationID: ${lastMutationID}, pullVersion: ${pullVersion}`
  );

  // Ensure the client exists
  let client = await prisma.replicacheClient.findUnique({
    where: { id: clientID },
  });

  if (!client) {
    console.log("New client. Creating entry in replicacheClient table...");
    client = await prisma.replicacheClient.create({
      data: {
        id: clientID,
        last_mutation_id: lastMutationID || 0,
      },
    });
  }

  // Use the lastMutationID from the request, or fall back to the stored value
  const currentLastMutationID = lastMutationID ?? client.last_mutation_id;

  // Get the current server version/timestamp for products
  const latestProduct = await prisma.product.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  const serverCookie = latestProduct
    ? latestProduct.updatedAt.getTime()
    : Date.now();

  // If this is a new client (cookie is null/0) or the cookie is outdated, send full sync
  const isNewClient = !cookie || cookie === 0;
  const isOutdated = cookie && cookie < serverCookie;

  let patch: PatchOperation[] = [];

  if (isNewClient || isOutdated) {
    console.log(
      `Sending full sync to client ${clientID}. New client: ${isNewClient}, Outdated: ${isOutdated}`
    );

    // Send full product list
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "asc" },
    });

    patch = [
      { op: "clear" },
      ...products.map((p) => ({
        op: "put" as const,
        key: `product/${p.id}`,
        value: {
          id: p.id,
          name: p.name,
          price: p.price,
          stock: p.stock,
          version: p.version,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        },
      })),
    ];
  } else {
    // Client is up to date, send empty patch
    console.log(`Client ${clientID} is up to date`);
    patch = [];
  }

  const response: PullResponse = {
    lastMutationID: currentLastMutationID,

    cookie: serverCookie,
    patch,
  };

  return {
    lastMutationIDChanges: {
      [clientID]: currentLastMutationID,
    },
    cookie: serverCookie,
    patch,
  };
}

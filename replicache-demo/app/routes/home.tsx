import type { ReadTransaction } from "replicache";
import { useSubscribe } from "replicache-react";
import { useReplicache } from "~/replicache/provider";

export type Message = {
  from: string;
  content: string;
  order: number;
};
export default function HomePage() {
  const replicache = useReplicache();

  const messages = useSubscribe(replicache, async (tx: ReadTransaction) => {
    const result = await tx.scan({prefix: "product/"}).values().toArray();
    return result;
  });

  return <div>{JSON.stringify(messages)}</div>;
}

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Replicache } from "replicache";

const createReplicacheClient = (userId?: string | null) => {
  if (typeof window === "undefined") {
    return null;
  }

  return new Replicache({
    name: userId!,
    licenseKey: "le64e83045c504c128aaaec9512fa940c",
    pushURL: "/api/replicache/push",
    pullURL: "/api/replicache/pull",
  });
};

export const ReplicacheContext = createContext<ReturnType<
  typeof createReplicacheClient
> | null>(null);

export const ReplicacheProvider = ({ children }: { children: ReactNode }) => {
  const [replicache, setReplicache] = useState<Replicache | null>(null);

  useEffect(() => {
    const rep = createReplicacheClient("default-user");
    if (rep) setReplicache(rep);
  }, []);

  if (!replicache) return null;

  return (
    <ReplicacheContext.Provider value={replicache}>
      {children}
    </ReplicacheContext.Provider>
  );
};

export function useReplicache() {
  const ctx = useContext(ReplicacheContext);

  if (!ctx) {
    throw new Error("useReplicache must be used within a ReplicacheProvider");
  }
  return ctx;
}

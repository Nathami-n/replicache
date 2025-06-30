import { useEffect, useState } from "react";
import {
  Replicache,
  type WriteTransaction,
} from "replicache";
import { useSubscribe } from "replicache-react";
import { nanoid } from "nanoid";

const CLIENT_ID_KEY = "replicache-pos-client-id";

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  version: number;
};

export default function DebugReplicache() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [isLoadingReplicache, setIsLoadingReplicache] = useState(true);
  const [rep, setRep] = useState<Replicache | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo((prev) => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  };

  useEffect(() => {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = nanoid();
      localStorage.setItem(CLIENT_ID_KEY, id);
      addDebugLog(`Generated new client ID: ${id}`);
    } else {
      addDebugLog(`Found existing client ID: ${id}`);
    }
    setClientId(id);
    setIsLoadingReplicache(false);
  }, []);

  useEffect(() => {
    if (!clientId || isLoadingReplicache) return;

    addDebugLog(`Initializing Replicache with name: ${clientId}`);

    const replicacheInstance = new Replicache({
      name: clientId,
      pullURL: "/api/replicache/pull",
      pushURL: "/api/replicache/push",
      mutators: {
        async createProduct(tx: WriteTransaction, { id, name, price, stock, version }) {
          addDebugLog(`Mutator: createProduct called for ${name}`);
          await tx.set(`product/${id}`, { id, name, price, stock, version });
        },
        async updateProductStock(tx: WriteTransaction, { id, stockChange }) {
          const product = await tx.get(`product/${id}`);
          if (!product) {
            addDebugLog(`Product not found for ID ${id}`);
            return;
          }
          const newStock = product.stock + stockChange;
          const newVersion = (product.version || 1) + 1;
          await tx.set(`product/${id}`, {
            ...product,
            stock: newStock,
            version: newVersion,
          });
          addDebugLog(`Updated stock for ${product.name} to ${newStock}`);
        },
      },
      licenseKey: "test",
    });

    replicacheInstance.onSync = (syncing) => {
      addDebugLog(`Replicache is ${syncing ? "SYNCING" : "IDLE"}`);
    };

    const originalPull = replicacheInstance.pull.bind(replicacheInstance);
    replicacheInstance.pull = async () => {
      addDebugLog("Manual pull triggered...");
      try {
        const result = await originalPull();
        addDebugLog("Pull success.");
        return result;
      } catch (err) {
        addDebugLog(`Pull failed: ${err.message}`);
        throw err;
      }
    };

    setRep(replicacheInstance);

    return () => {
      replicacheInstance.close();
      setRep(null);
    };
  }, [clientId, isLoadingReplicache]);

  const products = useSubscribe(
    rep,
    async (tx) => {
      addDebugLog("useSubscribe: Fetching products...");
      const list: Product[] = [];
      for await (const [key, value] of tx.scan({ prefix: "product/" }).entries()) {
        addDebugLog(`Found product: ${key}`);
        list.push(value as Product);
      }
      addDebugLog(`Total products: ${list.length}`);
      return list.sort((a, b) => a.name.localeCompare(b.name));
    },
    [rep]
  );

  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductStock, setNewProductStock] = useState("");

  const handleAddProduct = async () => {
    if (!rep) {
      addDebugLog("Replicache not ready.");
      return;
    }
    if (!newProductName || !newProductPrice || !newProductStock) {
      addDebugLog("Missing product fields.");
      return;
    }
    const id = nanoid();
    await rep.mutate.createProduct({
      id,
      name: newProductName,
      price: parseFloat(newProductPrice),
      stock: parseInt(newProductStock, 10),
      version: 1,
    });
    setNewProductName("");
    setNewProductPrice("");
    setNewProductStock("");
  };

  const handleSellProduct = async (id: string, currentStock: number) => {
    if (!rep || currentStock <= 0) return;
    await rep.mutate.updateProductStock({ id, stockChange: -1 });
  };

  const handleRestockProduct = async (id: string) => {
    if (!rep) return;
    await rep.mutate.updateProductStock({ id, stockChange: 1 });
  };

  const handleForcePull = async () => {
    if (!rep) return;
    await rep.pull();
  };

  const handleClearClientData = () => {
    localStorage.removeItem(CLIENT_ID_KEY);
    addDebugLog("Cleared client ID. Reload to reinitialize.");
  };

  const handleTestPullEndpoint = async () => {
    try {
      const response = await fetch("/api/replicache/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientGroupID: clientId,
          cookie: null,
          lastMutationID: 0,
        }),
      });
      const data = await response.json();
      addDebugLog(`Pull response: ${JSON.stringify(data, null, 2)}`);
    } catch (err) {
      addDebugLog(`Test pull failed: ${err.message}`);
    }
  };

  if (isLoadingReplicache || !rep) {
    return (
      <div style={{ padding: "20px", fontFamily: "monospace" }}>
        <h2>Initializing POS terminal...</h2>
        <p>Please wait while Replicache connects and syncs data.</p>
        {clientId && (
          <p>
            Client ID: <code>{clientId}</code>
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Debug Replicache POS Demo</h1>
      <p>
        Client ID: <code>{clientId}</code>
      </p>

      <div style={{ backgroundColor: "#f5f5f5", padding: "15px", borderRadius: "5px", marginBottom: "20px" }}>
        <h3>Debug Controls</h3>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={handleForcePull} style={{ padding: "8px 12px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px" }}>Force Pull</button>
          <button onClick={handleTestPullEndpoint} style={{ padding: "8px 12px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px" }}>Test Pull Endpoint</button>
          <button onClick={handleClearClientData} style={{ padding: "8px 12px", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "4px" }}>Clear Client Data</button>
        </div>
      </div>

      <div style={{ marginBottom: "30px" }}>
        <h2>Add New Product</h2>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <input type="text" placeholder="Product Name" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }} />
          <input type="number" step="0.01" placeholder="Price" value={newProductPrice} onChange={(e) => setNewProductPrice(e.target.value)} style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }} />
          <input type="number" placeholder="Stock" value={newProductStock} onChange={(e) => setNewProductStock(e.target.value)} style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }} />
          <button onClick={handleAddProduct} style={{ padding: "8px 15px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px" }}>Add Product</button>
        </div>
      </div>

      <div style={{ marginBottom: "30px" }}>
        <h2>Current Products ({products?.length ?? 0})</h2>
        {products?.length === 0 ? (
          <p>No products found. This might indicate a sync issue.</p>
        ) : (
          <div>
            {products?.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "15px", padding: "10px", borderBottom: "1px solid #eee" }}>
                <strong style={{ flex: 2 }}>{p.name}</strong>
                <span style={{ flex: 1 }}>${p.price.toFixed(2)}</span>
                <span style={{ flex: 1 }}>Stock: {p.stock} (v{p.version})</span>
                <button onClick={() => handleSellProduct(p.id, p.stock)} disabled={p.stock <= 0} style={{ padding: "5px 10px", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "4px" }}>Sell</button>
                <button onClick={() => handleRestockProduct(p.id)} style={{ padding: "5px 10px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px" }}>Restock</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3>Debug Log</h3>
        <div style={{ backgroundColor: "#000", color: "#00ff00", padding: "15px", borderRadius: "5px", height: "300px", overflow: "auto", fontFamily: "monospace", fontSize: "12px" }}>
          {debugInfo.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

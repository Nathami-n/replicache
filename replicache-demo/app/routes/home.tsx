import { useEffect, useMemo, useState } from "react";
import {
  Replicache,
  type ReadTransaction,
  type WriteTransaction,
} from "replicache";
import { useSubscribe } from "replicache-react";
import { nanoid } from "nanoid";
import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Remix Replicache POS Demo" },
  {
    name: "description",
    content: "A single-client POS with offline capabilities!",
  },
];

const CLIENT_ID_KEY = "replicache-pos-client-id";

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  version: number;
};

export default function Home() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [isLoadingReplicache, setIsLoadingReplicache] = useState(true)

  console.log("Client ID state:", clientId);

  useEffect(() => {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = nanoid();
      localStorage.setItem(CLIENT_ID_KEY, id);
      console.log("Generated new client ID:", id);
    } else {
      console.log("Found existing client ID:", id);
    }
    setClientId(id);
    // Set loading to false only after clientId is set, allowing Replicache to initialize
    setIsLoadingReplicache(false);
  }, []);

  const rep = useMemo(
    () => {
      if (!clientId) {
        console.log("Replicache not initializing yet, clientId is null.");
        return undefined;
      }
      console.log("Initializing Replicache with name:", clientId);
      const replicacheInstance = new Replicache({
        name: clientId,
        pullURL: "/api/replicache/pull",
        pushURL: "/api/replicache/push",
        mutators: {
          async createProduct(
            tx: WriteTransaction,
            { id, name, price, stock, version }
          ) {
            console.log("Mutator: createProduct called with:", { id, name, price, stock, version });
            await tx.set(`product/${id}`, {
              id,
              name,
              price,
              stock,
              version,
            });
            console.log(`Mutator: Product ${name} set in Replicache local state.`);
          },
          async updateProductStock(
            tx: WriteTransaction,
            { id, stockChange }
          ) {
            console.log("Mutator: updateProductStock called with:", { id, stockChange });
            const product = await tx.get(`product/${id}`);
            if (product) {
              const newStock = (product.stock || 0) + stockChange;
              const newVersion = (product.version || 1) + 1;
              await tx.set(`product/${id}`, {
                ...product,
                stock: newStock,
                version: newVersion,
              });
              console.log(`Mutator: Product ${product.name} stock updated to ${newStock} (v${newVersion})`);
            } else {
              console.warn(`Mutator: Product with ID ${id} not found for stock update.`);
            }
          },
        },
        licenseKey: "test",
      });


      return replicacheInstance;
    },
    [clientId, isLoadingReplicache] 
  );

  const products = useSubscribe(
    rep,
    async (tx) => {
      console.log("useSubscribe: Fetching products from Replicache local state...");
      const list: Product[] = [];
      for await (const [, value] of tx.scan({ prefix: "product/" }).entries()) {
        list.push(value as Product);
      }
      console.log("useSubscribe: Found products in local state:", list.length);
      return list.sort((a, b) => a.name.localeCompare(b.name));
    },
    [rep]
  );

  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductStock, setNewProductStock] = useState("");

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rep) {
      console.warn("handleAddProduct: Replicache instance not ready.");
      return;
    }
    if (!newProductName || !newProductPrice || !newProductStock) {
      // Replaced alert with console.error for better debugging in Canvas
      console.error("Please fill all fields for the new product.");
      return;
    }
    const id = nanoid();
    console.log("handleAddProduct: Calling createProduct mutator...");
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
    console.log("handleAddProduct: createProduct mutator called successfully.");
  };

  const handleSellProduct = async (productId: string, currentStock: number) => {
    if (!rep) {
      console.warn("handleSellProduct: Replicache instance not ready.");
      return;
    }
    if (currentStock <= 0) {
      console.warn("Cannot sell, stock is zero!");
      return;
    }
    console.log("handleSellProduct: Calling updateProductStock mutator (sell)...");
    await rep.mutate.updateProductStock({ id: productId, stockChange: -1 });
    console.log("handleSellProduct: updateProductStock (sell) mutator called successfully.");
  };

  const handleRestockProduct = async (productId: string) => {
    if (!rep) {
      console.warn("handleRestockProduct: Replicache instance not ready.");
      return;
    }
    console.log("handleRestockProduct: Calling updateProductStock mutator (restock)...");
    await rep.mutate.updateProductStock({ id: productId, stockChange: 1 });
    console.log("handleRestockProduct: updateProductStock (restock) mutator called successfully.");
  };

  // Improved loading state
  if (isLoadingReplicache || !rep) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h2>Initializing POS terminal...</h2>
        <p>Please wait while Replicache connects and syncs data.</p>
        {clientId && <p>Client ID: <code>{clientId}</code></p>}
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        lineHeight: "1.8",
        maxWidth: "800px",
        margin: "20px auto",
        padding: "20px",
        border: "1px solid #eee",
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
      <h1 style={{ textAlign: "center", color: "#333" }}>
        Remix Replicache POS Demo
      </h1>
      <p style={{ textAlign: "center", color: "#666" }}>
        Client ID: <code>{clientId ?? "Loading..."}</code> (This identifies your
        POS terminal to the server)
      </p>

      <hr style={{ margin: "20px 0" }} />

      <h2>Add New Product</h2>
      <form
        onSubmit={handleAddProduct}
        style={{
          display: "grid",
          gap: "10px",
          padding: "15px",
          border: "1px dashed #ccc",
          borderRadius: "5px",
          marginBottom: "30px",
        }}
      >
        <input
          type="text"
          placeholder="Product Name"
          value={newProductName}
          onChange={(e) => setNewProductName(e.target.value)}
          required
          style={{
            padding: "8px",
            borderRadius: "4px",
            border: "1px solid #ddd",
          }}
        />
        <input
          type="number"
          step="0.01"
          placeholder="Price (e.g., 19.99)"
          value={newProductPrice}
          onChange={(e) => setNewProductPrice(e.target.value)}
          required
          style={{
            padding: "8px",
            borderRadius: "4px",
            border: "1px solid #ddd",
          }}
        />
        <input
          type="number"
          placeholder="Stock"
          value={newProductStock}
          onChange={(e) => setNewProductStock(e.target.value)}
          required
          style={{
            padding: "8px",
            borderRadius: "4px",
            border: "1px solid #ddd",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px 15px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Add Product
        </button>
      </form>

      <h2>Current Products ({products?.length ?? 0})</h2>
      {products?.length === 0 ? (
        <p>No products added yet. Add one above!</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {products?.map((p) => (
            <li
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "15px",
                padding: "10px",
                borderBottom: "1px solid #eee",
              }}
            >
              <strong style={{ flex: 2 }}>{p.name}</strong>
              <span style={{ flex: 1 }}>${p.price.toFixed(2)}</span>
              <span style={{ flex: 1 }}>
                Stock: {p.stock} (v{p.version})
              </span>
              <div style={{ flex: 1, display: "flex", gap: "5px" }}>
                <button
                  onClick={() => handleSellProduct(p.id, p.stock)}
                  disabled={p.stock <= 0}
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#f44336",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Sell (-1)
                </button>
                <button
                  onClick={() => handleRestockProduct(p.id)}
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#2196F3",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Restock (+1)
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
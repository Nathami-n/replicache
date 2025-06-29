import { useEffect, useMemo, useState } from "react";
import { Replicache } from "replicache";
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

  useEffect(() => {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = nanoid();
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    setClientId(id);
  }, []);

  const rep = useMemo(
    () =>
      clientId
        ? new Replicache({
            name: clientId,
            pullURL: "/api/replicache/pull",
            pushURL: "/api/replicache/push",
            mutators: {
              async createProduct(tx, { id, name, price, stock, version }) {
                await tx.set(`product/${id}`, {
                  id,
                  name,
                  price,
                  stock,
                  version,
                });
              },
              async updateProductStock(tx, { id, stockChange }) {
                const product = await tx.get(`product/${id}`);
                if (product) {
                  await tx.set(`product/${id}`, {
                    ...product,
                    stock: (product.stock || 0) + stockChange,
                    version: (product.version || 1) + 1,
                  });
                }
              },
            },
            licenseKey: "test",
          })
        : undefined,
    [clientId]
  );

  const products = useSubscribe(
    rep!,
    async (tx) => {
      const list: Product[] = [];
      for await (const [, value] of tx.scan({ prefix: "product/" })) {
        list.push(value as Product);
      }
      return list.sort((a, b) => a.name.localeCompare(b.name));
    },
    [rep]
  );

  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductStock, setNewProductStock] = useState("");

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rep) return;
    if (!newProductName || !newProductPrice || !newProductStock) {
      alert("Please fill all fields for the new product.");
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

  const handleSellProduct = async (productId: string, currentStock: number) => {
    if (!rep) return;
    if (currentStock <= 0) {
      alert("Cannot sell, stock is zero!");
      return;
    }
    await rep.mutate.updateProductStock({ id: productId, stockChange: -1 });
  };

  const handleRestockProduct = async (productId: string) => {
    if (!rep) return;
    await rep.mutate.updateProductStock({ id: productId, stockChange: 1 });
  };

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

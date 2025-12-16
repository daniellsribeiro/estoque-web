"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ProtectedShell } from "@/components/protected-shell";
import { apiFetch } from "@/lib/api-client";

type Option = { id: string; nome: string; codigo?: string };
type Product = {
  id: string;
  codigo: string;
  nome: string;
  observacao?: string;
  ativo: boolean;
  tipo?: Option;
  cor?: Option;
  material?: Option;
  tamanho?: Option;
  preco?: { precoVendaAtual: number };
};
type CategoryKey = "tipos" | "cores" | "materiais" | "tamanhos";
type CatalogPayload = { nome: string; codigo: string };
type FormField = { name: string; label: string; required?: boolean; maxLength?: number };

const toUpper = (v: FormDataEntryValue | null) => v?.toString().toUpperCase() ?? "";
const PER_PAGE = 20;

export default function ProdutosPage() {
  const [tipos, setTipos] = useState<Option[]>([]);
  const [cores, setCores] = useState<Option[]>([]);
  const [materiais, setMateriais] = useState<Option[]>([]);
  const [tamanhos, setTamanhos] = useState<Option[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [productModalError, setProductModalError] = useState<string | null>(null);
  const [priceModalError, setPriceModalError] = useState<string | null>(null);
  const [editModalError, setEditModalError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | "">("");
  const [showFormCatalog, setShowFormCatalog] = useState(false);
  const [showFormProduct, setShowFormProduct] = useState(false);
  const [filter, setFilter] = useState("");
  const [filtersProduct, setFiltersProduct] = useState({
    search: "",
    tipo: "",
    cor: "",
    material: "",
    tamanho: "",
  });
  const [formVersion, setFormVersion] = useState(0);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [priceHistory, setPriceHistory] = useState<
    | { productId: string; rows: { precoAntigo: number; precoNovo: number; createdAt?: string; motivo?: string }[] }
    | null
  >(null);
  const [priceModalProduct, setPriceModalProduct] = useState<Product | null>(null);
  const [priceInput, setPriceInput] = useState("0,00");
  const [priceCreateInput, setPriceCreateInput] = useState("0,00");
  const [salvandoProduto, setSalvandoProduto] = useState(false);
  const [salvandoPreco, setSalvandoPreco] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const skipFirstFilterLoad = useRef(true);

  const categories: Record<CategoryKey, { label: string; desc: string; fields: FormField[]; path: string }> = useMemo(
    () => ({
      tipos: {
        label: "Tipos",
        desc: "Código com 2 letras",
        path: "/produtos/tipos",
        fields: [
          { name: "nome", label: "Nome", required: true, maxLength: 30 },
          { name: "codigo", label: "Código (2 letras)", required: true, maxLength: 2 },
        ],
      },
      cores: {
        label: "Cores",
        desc: "Código com 3 letras",
        path: "/produtos/cores",
        fields: [
          { name: "nome", label: "Nome", required: true, maxLength: 30 },
          { name: "codigo", label: "Código (3 letras)", required: true, maxLength: 3 },
        ],
      },
      materiais: {
        label: "Materiais",
        desc: "Código com 3 letras",
        path: "/produtos/materiais",
        fields: [
          { name: "nome", label: "Nome", required: true, maxLength: 30 },
          { name: "codigo", label: "Código (3 letras)", required: true, maxLength: 3 },
        ],
      },
      tamanhos: {
        label: "Tamanhos",
        desc: "Código com até 3 caracteres",
        path: "/produtos/tamanhos",
        fields: [
          { name: "nome", label: "Nome", required: true, maxLength: 30 },
          { name: "codigo", label: "Código (até 3 caracteres)", required: true, maxLength: 3 },
        ],
      },
    }),
    [],
  );

  const catalogData = { tipos, cores, materiais, tamanhos };

  const loadCatalogs = async () => {
    const [tiposData, coresData, materiaisData, tamanhosData] = await Promise.all([
      apiFetch<Option[]>("/produtos/tipos"),
      apiFetch<Option[]>("/produtos/cores"),
      apiFetch<Option[]>("/produtos/materiais"),
      apiFetch<Option[]>("/produtos/tamanhos"),
    ]);
    setTipos(tiposData ?? []);
    setCores(coresData ?? []);
    setMateriais(materiaisData ?? []);
    setTamanhos(tamanhosData ?? []);
  };

  const loadProducts = async (targetPage = 1) => {
    setLoadingProducts(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("limit", String(PER_PAGE));
      if (filtersProduct.search.trim()) params.set("search", filtersProduct.search.trim());
      if (filtersProduct.tipo) params.set("tipo", filtersProduct.tipo);
      if (filtersProduct.cor) params.set("cor", filtersProduct.cor);
      if (filtersProduct.material) params.set("material", filtersProduct.material);
      if (filtersProduct.tamanho) params.set("tamanho", filtersProduct.tamanho);

      const data = await apiFetch<{ items?: Product[]; total?: number; page?: number; perPage?: number } | Product[]>(
        `/produtos?${params.toString()}`,
      );
      const list = Array.isArray(data) ? data : data?.items ?? [];
      const perPage = Array.isArray(data) ? PER_PAGE : data?.perPage ?? PER_PAGE;
      const total = Array.isArray(data) ? undefined : data?.total;
      const currentPage = !Array.isArray(data) && data?.page ? data.page : targetPage;
      setProducts(list);
      if (typeof total === "number") {
        setHasMore(currentPage * perPage < total);
      } else {
        setHasMore(list.length === perPage);
      }
      setPage(currentPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar produtos");
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        await Promise.all([loadCatalogs(), loadProducts(1)]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refetch when filters change
  useEffect(() => {
    if (skipFirstFilterLoad.current) {
      skipFirstFilterLoad.current = false;
      return;
    }
    void loadProducts(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersProduct.search, filtersProduct.tipo, filtersProduct.cor, filtersProduct.material, filtersProduct.tamanho]);

  async function handleCreateCatalog(path: string, body: CatalogPayload) {
    if (path === "/produtos/tamanhos") {
      const codigo = toUpper(body.codigo).trim();
      if (!codigo) {
        throw new Error("Informe o código do tamanho");
      }
      body.codigo = codigo.slice(0, 3).padStart(3, "0");
    } else {
      body.codigo = toUpper(body.codigo);
    }
    await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
    await loadCatalogs();
  }

  async function handleDeleteCatalog(category: CategoryKey, id: string) {
    await apiFetch(`${categories[category].path}/${id}`, { method: "DELETE" });
    await loadCatalogs();
  }

  async function handleCreateProduct(formData: FormData) {
    if (salvandoProduto) return;
    const preco = parseCurrency(priceCreateInput);
    if (Number.isNaN(preco) || preco <= 0) {
      setProductModalError("Informe um preco de venda valido.");
      return;
    }
    const body = {
      nome: (formData.get("nome") ?? "").toString().trim(),
      tipoProdutoId: formData.get("tipo") || undefined,
      corId: formData.get("cor") || undefined,
      materialId: formData.get("material") || undefined,
      tamanhoId: formData.get("tamanho") || undefined,
      observacao: (formData.get("observacao") ?? "").toString().trim() || undefined,
      precoVendaAtual: preco,
      ativo: true,
    };
    try {
      setSalvandoProduto(true);
      setProductModalError(null);
      setMessage(null);
      await apiFetch("/produtos", { method: "POST", body: JSON.stringify(body) });
      await loadProducts(1);
      setMessage("Produto adicionado com sucesso");
      setShowFormProduct(false);
      setPriceCreateInput("0,00");
    } catch (err) {
      setProductModalError(err instanceof Error ? err.message : "Erro ao salvar produto");
      setMessage(null);
    } finally {
      setSalvandoProduto(false);
    }
  }

  async function handleUpdateProduct(id: string, body: { nome?: string; observacao?: string }) {
    await apiFetch(`/produtos/${id}`, { method: "POST", body: JSON.stringify(body) });
    await loadProducts(page);
  }

  async function handleDeleteProduct(id: string) {
    await apiFetch(`/produtos/${id}`, { method: "DELETE" });
    await loadProducts(page);
  }

  const formatCurrency = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const padded = (digits || "0").padStart(3, "0");
    const intPart = padded.slice(0, -2).replace(/^0+(?=\d)/, "") || "0";
    const decimal = padded.slice(-2);
    const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${withThousands},${decimal}`;
  };

  const parseCurrency = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const cents = parseInt(digits || "0", 10);
    return cents / 100;
  };

  function openPriceEditor(product: Product) {
    const current = product.preco?.precoVendaAtual ?? 0;
    setPriceModalProduct(product);
    setPriceInput(formatCurrency(Math.round(current * 100).toString()));
    setPriceModalError(null);
  }

  async function handleSavePrice() {
    if (!priceModalProduct || salvandoPreco) return;
    const value = parseCurrency(priceInput);
    if (Number.isNaN(value) || value <= 0) {
      setPriceModalError("Informe um valor numerico maior que zero.");
      return;
    }
    try {
      setSalvandoPreco(true);
      setPriceModalError(null);
      await apiFetch(`/produtos/${priceModalProduct.id}/preco`, {
        method: "POST",
        body: JSON.stringify({ precoVendaAtual: value }),
      });
      await loadProducts(page);
      setPriceModalProduct(null);
    } catch (err) {
      setPriceModalError(err instanceof Error ? err.message : "Erro ao salvar preco");
    } finally {
      setSalvandoPreco(false);
    }
  }

  async function loadPriceHistory(product: Product) {
    const rows = await apiFetch<{ precoAntigo: number; precoNovo: number; createdAt?: string; motivo?: string }[]>(
      `/produtos/${product.id}/preco/historico`,
    );
    setPriceHistory({ productId: product.id, rows: rows ?? [] });
  }

  return (
    <ProtectedShell title="Produtos" subtitle="Catálogo e Cadastro">
      {message && (
        <div className="mb-4 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 ring-1 ring-emerald-500/40">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-500/40">
          {error}
        </div>
      )}

      <div className="rounded-xl bg-slate-900/70 p-6 ring-1 ring-slate-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-50">Produtos</h3>
            <p className="text-sm text-slate-400">Clique para ver detalhes e ações.</p>
          </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setProductModalError(null);
              setShowFormProduct(true);
            }}
            className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow hover:bg-cyan-400 transition"
          >
            Adicionar produto
          </button>
          <button
            onClick={() => {
              setSelectedCategory("tipos");
              setError(null);
              setShowFormCatalog(true);
            }}
              className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-cyan-400 transition"
            >
              Gerenciar catálogos
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input
            value={filtersProduct.search}
            onChange={(e) => setFiltersProduct((p) => ({ ...p, search: e.target.value }))}
            placeholder="Filtrar por nome/codigo/observacao"
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400 md:col-span-2 xl:col-span-2"
          />
          <select
            value={filtersProduct.tipo}
            onChange={(e) => setFiltersProduct((p) => ({ ...p, tipo: e.target.value }))}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400"
          >
            <option value="">Tipo</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
          <select
            value={filtersProduct.cor}
            onChange={(e) => setFiltersProduct((p) => ({ ...p, cor: e.target.value }))}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400"
          >
            <option value="">Cor</option>
            {cores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <select
            value={filtersProduct.material}
            onChange={(e) => setFiltersProduct((p) => ({ ...p, material: e.target.value }))}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400"
          >
            <option value="">Material</option>
            {materiais.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
          <select
            value={filtersProduct.tamanho}
            onChange={(e) => setFiltersProduct((p) => ({ ...p, tamanho: e.target.value }))}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400"
          >
            <option value="">Tamanho</option>
            {tamanhos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 overflow-auto rounded-lg border border-slate-800 bg-slate-900/50">
          <table className="min-w-full text-sm text-slate-200">
            <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Codigo</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Cor</th>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3">Tamanho</th>
                <th className="px-4 py-3">Preco</th>
                <th className="px-4 py-3">Observação</th>
              </tr>
            </thead>
            <tbody>
              {loadingProducts ? (
                <tr>
                  <td colSpan={8} className="px-4 py-3 text-center text-slate-400">
                    Carregando...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-3 text-center text-slate-400">
                    Nenhum produto encontrado
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-slate-800 hover:bg-slate-800/40 cursor-pointer transition"
                    onClick={() => setSelectedProduct(p)}
                  >
                    <td className="px-4 py-2">{p.codigo}</td>
                    <td className="px-4 py-2">{p.nome}</td>
                    <td className="px-4 py-2">{p.tipo?.nome ?? "-"}</td>
                    <td className="px-4 py-2">{p.cor?.nome ?? "-"}</td>
                    <td className="px-4 py-2">{p.material?.nome ?? "-"}</td>
                    <td className="px-4 py-2">{p.tamanho?.nome ?? "-"}</td>
                    <td className="px-4 py-2">
                      {p.preco?.precoVendaAtual !== undefined ? `R$ ${p.preco.precoVendaAtual.toFixed(2)}` : "-"}
                    </td>
                    <td className="px-4 py-2">{p.observacao ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-end gap-3 text-sm text-slate-200">
          <button
            type="button"
            disabled={page === 1 || loadingProducts}
            onClick={() => void loadProducts(Math.max(1, page - 1))}
            className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-cyan-400 disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-xs text-slate-400">Página {page}</span>
          <button
            type="button"
            disabled={!hasMore || loadingProducts}
            onClick={() => void loadProducts(page + 1)}
            className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-cyan-400 disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      </div>

      {showFormProduct && (
        <ModalShell
          title="Adicionar produto"
          onClose={() => {
            setShowFormProduct(false);
            setProductModalError(null);
          }}
        >
          {productModalError && (
            <div className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-500/40">
              {productModalError}
            </div>
          )}
          <ProductForm
            priceCreateInput={priceCreateInput}
            setPriceCreateInput={setPriceCreateInput}
            formatCurrency={formatCurrency}
            handleCreateProduct={handleCreateProduct}
            saving={salvandoProduto}
            tipos={tipos}
            cores={cores}
            materiais={materiais}
            tamanhos={tamanhos}
            onCancel={() => setShowFormProduct(false)}
          />
        </ModalShell>
      )}

      {selectedProduct && (
        <ModalShell title={`Detalhes de ${selectedProduct.nome}`} onClose={() => setSelectedProduct(null)}>
          <ProductDetails
            product={selectedProduct}
            onEdit={() => {
              setEditModalError(null);
              setEditingProduct(selectedProduct);
            }}
            onPrice={() => openPriceEditor(selectedProduct)}
            onHistory={() => loadPriceHistory(selectedProduct)}
            onDelete={handleDeleteProduct}
            onClose={() => setSelectedProduct(null)}
          />
        </ModalShell>
      )}

      {editingProduct && (
        <ModalShell
          title="Editar produto"
          onClose={() => {
            setEditingProduct(null);
            setEditModalError(null);
          }}
          zClass="z-60"
        >
          {editModalError && (
            <div className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-500/40">
              {editModalError}
            </div>
          )}
          <ProductEditForm
            product={editingProduct}
            onCancel={() => setEditingProduct(null)}
            onSave={handleUpdateProduct}
            onSaved={async () => {
              setEditingProduct(null);
              setEditModalError(null);
              await loadProducts(page);
            }}
            onError={(msg) => setEditModalError(msg)}
            error={editModalError ?? undefined}
          />
        </ModalShell>
      )}

      {priceModalProduct && (
        <ModalShell
          title="Atualizar preço"
          onClose={() => {
            setPriceModalProduct(null);
            setPriceModalError(null);
          }}
          zClass="z-60"
        >
          {priceModalError && (
            <div className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-500/40">
              {priceModalError}
            </div>
          )}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={priceInput}
              onChange={(e) => setPriceInput(formatCurrency(e.target.value))}
              inputMode="decimal"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400"
              aria-label="Preço de venda"
            />
            <button
              onClick={handleSavePrice}
              disabled={salvandoPreco}
              className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-60"
            >
              {salvandoPreco ? "Salvando..." : "Salvar preço"}
            </button>
          </div>
        </ModalShell>
      )}

      {priceHistory && (
        <ModalShell title="Histórico de preços" onClose={() => setPriceHistory(null)} zClass="z-60">
          <div className="mt-3 max-h-60 overflow-auto">
            {priceHistory.rows?.length ? (
              <ul className="space-y-2 text-sm text-slate-200">
                {priceHistory.rows.map((row, idx) => (
                  <li key={idx} className="rounded-lg bg-slate-800/60 px-3 py-2 ring-1 ring-slate-700/60">
                    <div className="flex items-center justify-between">
                      <span>De R$ {Number(row.precoAntigo).toFixed(2)} para R$ {Number(row.precoNovo).toFixed(2)}</span>
                      <span className="text-xs text-slate-400">
                        {row.createdAt ? new Date(row.createdAt).toLocaleString("pt-BR") : ""}
                      </span>
                    </div>
                    {row.motivo && <div className="text-xs text-slate-400">Motivo: {row.motivo}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-400">Sem histórico encontrado.</div>
            )}
          </div>
        </ModalShell>
      )}

      {showFormCatalog && (
        <ModalShell title="Gerenciar catálogos" onClose={() => setShowFormCatalog(false)}>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="flex flex-wrap items-center gap-2">
                  {(Object.keys(categories) as CategoryKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedCategory(key);
                        setFilter("");
                        setFormVersion((v) => v + 1);
                      }}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        selectedCategory === key
                          ? "bg-cyan-400 text-slate-900"
                          : "bg-slate-800 text-slate-100 ring-1 ring-slate-700 hover:bg-slate-700"
                      }`}
                    >
                      {categories[key].label}
                    </button>
                  ))}
                </div>

                {selectedCategory && (
                  <CategoryManager
                    category={selectedCategory}
                    categories={categories}
                    data={catalogData}
                    loading={loading}
                    filter={filter}
                    onFilterChange={setFilter}
                    onCreate={handleCreateCatalog}
                    onDelete={handleDeleteCatalog}
                    formKey={formVersion}
                  />
                )}
              </div>
            </div>
          </div>
        </ModalShell>
      )}
    </ProtectedShell>
  );
}

function ProductForm({
  priceCreateInput,
  setPriceCreateInput,
  formatCurrency,
  handleCreateProduct,
  saving,
  tipos,
  cores,
  materiais,
  tamanhos,
  onCancel,
}: {
  priceCreateInput: string;
  setPriceCreateInput: (v: string) => void;
  formatCurrency: (v: string) => string;
  handleCreateProduct: (fd: FormData) => Promise<void>;
  saving: boolean;
  tipos: Option[];
  cores: Option[];
  materiais: Option[];
  tamanhos: Option[];
  onCancel: () => void;
}) {
  return (
    <form
      className="grid gap-3 text-sm md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await handleCreateProduct(fd);
      }}
    >
      <input
        name="nome"
        required
        maxLength={30}
        placeholder="Nome"
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
      />
      <input
        name="precoVendaAtual"
        required
        value={priceCreateInput}
        onChange={(e) => setPriceCreateInput(formatCurrency(e.target.value))}
        placeholder="Preço de venda (R$)"
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
        inputMode="decimal"
      />
      <input
        name="observacao"
        maxLength={30}
        placeholder="Observação (opcional)"
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
      />
      <select
        name="tipo"
        required
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
      >
        <option value="">Tipo</option>
        {tipos.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nome} ({t.codigo})
          </option>
        ))}
      </select>
      <select
        name="cor"
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
      >
        <option value="">Cor (opcional)</option>
        {cores.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
      <select
        name="material"
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
      >
        <option value="">Material (opcional)</option>
        {materiais.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nome}
          </option>
        ))}
      </select>
      <select
        name="tamanho"
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
      >
        <option value="">Tamanho (opcional)</option>
        {tamanhos.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nome}
          </option>
        ))}
      </select>
      <div className="md:col-span-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar produto"}
        </button>
      </div>
    </form>
  );
}

function ProductDetails({
  product,
  onEdit,
  onPrice,
  onHistory,
  onDelete,
  onClose,
}: {
  product: Product;
  onEdit: () => void;
  onPrice: () => void;
  onHistory: () => void;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4 text-sm text-slate-200">
      <div className="grid gap-2 md:grid-cols-2">
        <InfoRow label="Código" value={product.codigo} />
        <InfoRow label="Tipo" value={product.tipo?.nome} />
        <InfoRow label="Cor" value={product.cor?.nome} />
        <InfoRow label="Material" value={product.material?.nome} />
        <InfoRow label="Tamanho" value={product.tamanho?.nome} />
        <InfoRow
          label="Preço"
          value={
            product.preco?.precoVendaAtual !== undefined ? `R$ ${product.preco.precoVendaAtual.toFixed(2)}` : "-"
          }
        />
        <div className="md:col-span-2">
          <p className="text-xs text-slate-400">Observação</p>
          <p className="text-sm text-slate-100">{product.observacao || "-"}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 ring-1 ring-slate-600 transition hover:bg-slate-600"
          onClick={onEdit}
        >
          Editar
        </button>
        <button
          className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 ring-1 ring-slate-600 transition hover:bg-slate-600"
          onClick={onPrice}
        >
          Preço
        </button>
        <button
          className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 ring-1 ring-slate-600 transition hover:bg-slate-600"
          onClick={onHistory}
        >
          Histórico
        </button>
        <button
          className="rounded-lg bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-400"
          onClick={async () => {
            if (!confirm("Excluir produto? Estoque deve ser 0 e o item não pode estar em uso.")) return;
            await onDelete(product.id);
            onClose();
          }}
        >
          Excluir
        </button>
      </div>
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
  zClass = "z-50",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  zClass?: string;
}) {
  return (
    <div className={`fixed inset-0 ${zClass} flex items-center justify-center bg-slate-900/80 px-4`}>
      <div className="w-full max-w-4xl rounded-2xl bg-slate-900 p-5 text-slate-100 ring-1 ring-slate-700 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-50">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-800 px-3 py-1 text-sm font-semibold text-slate-200 ring-1 ring-slate-700 transition hover:bg-slate-700"
          >
            Fechar
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-lg bg-slate-800/60 px-3 py-2 ring-1 ring-slate-700/60">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-100">{value ?? "-"}</p>
    </div>
  );
}

function CategoryManager({
  category,
  categories,
  data,
  loading,
  filter,
  onFilterChange,
  onCreate,
  onDelete,
  formKey,
}: {
  category: CategoryKey;
  categories: Record<CategoryKey, { label: string; desc: string; fields: FormField[]; path: string }>;
  data: Record<CategoryKey, Option[]>;
  loading: boolean;
  filter: string;
  onFilterChange: (v: string) => void;
  onCreate: (path: string, body: CatalogPayload) => Promise<void>;
  onDelete: (category: CategoryKey, id: string) => Promise<void>;
  formKey: number;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const current = categories[category];
  const list = (data[category] ?? []).filter((item) =>
    filter.trim() ? item.nome.toLowerCase().includes(filter.trim().toLowerCase()) : true,
  );

  useEffect(() => {
    setShowForm(false);
    setError(null);
  }, [category]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const fd = new FormData(e.currentTarget);
    const body: CatalogPayload = {
      nome: (fd.get("nome") ?? "").toString().trim(),
      codigo: (fd.get("codigo") ?? "").toString().trim(),
    };
    try {
      setSaving(true);
      setError(null);
      await onCreate(current.path, body);
      formEl?.reset?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-100">{current.label}</p>
          <p className="text-xs text-slate-400">{current.desc}</p>
        </div>
        <div className="flex w-full max-w-xl items-center gap-2">
          <input
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="Filtrar lista..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400"
          />
          <button
            type="button"
            onClick={() => {
              setShowForm((prev) => {
                const next = !prev;
                if (next) {
                  setTimeout(() => {
                    const firstInput = document.querySelector<HTMLInputElement>('form input[name=\"nome\"]');
                    firstInput?.focus();
                  }, 0);
                } else {
                  setError(null);
                  onFilterChange("");
                }
                return next;
              });
            }}
            className="whitespace-nowrap rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300"
          >
            {showForm ? "Fechar" : "Adicionar"}
          </button>
        </div>
      </div>

      {showForm && (
        <form
          key={formKey}
          className="grid gap-3 rounded-xl bg-slate-900/60 p-4 ring-1 ring-slate-800 md:grid-cols-[2fr_1fr_auto]"
          onSubmit={handleSubmit}
        >
          {current.fields.map((field) => (
            <input
              key={field.name}
              name={field.name}
              required={field.required}
              maxLength={field.maxLength}
              placeholder={field.label}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400"
            />
          ))}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Adicionar"}
            </button>
          </div>
          {error && <div className="md:col-span-3 text-sm text-rose-400">{error}</div>}
        </form>
      )}

      <div className="rounded-xl bg-slate-900/60 p-3 ring-1 ring-slate-800">
        {loading ? (
          <div className="text-sm text-slate-400">Carregando...</div>
        ) : (
          <ul className="divide-y divide-slate-800 text-sm text-slate-100">
            {list.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-semibold">{item.nome}</p>
                  {item.codigo && <p className="text-xs text-slate-400">{item.codigo}</p>}
                </div>
                <button
                  onClick={() => onDelete(category, item.id)}
                  className="rounded-lg bg-rose-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-rose-400"
                >
                  Excluir
                </button>
              </li>
            ))}
            {!list.length && <li className="py-2 text-sm text-slate-400">Nenhum item encontrado.</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

function ProductEditForm({
  product,
  onCancel,
  onSave,
  onSaved,
  onError,
  error,
}: {
  product: Product;
  onCancel: () => void;
  onSave: (id: string, body: { nome?: string; observacao?: string }) => Promise<void>;
  onSaved: () => Promise<void>;
  onError: (msg: string) => void;
  error?: string;
}) {
  const [nome, setNome] = useState(product.nome);
  const [observacao, setObservacao] = useState(product.observacao ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setSaving(true);
      await onSave(product.id, { nome: nome.trim(), observacao: observacao.trim() || undefined });
      await onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-3 text-sm" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="block text-xs text-slate-400">Nome</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={60}
          required
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
        />
      </div>
      <div className="space-y-2">
        <label className="block text-xs text-slate-400">ObservaÇõÇœes</label>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          maxLength={200}
          className="h-24 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
        />
      </div>
      {error && (
        <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-500/40">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}

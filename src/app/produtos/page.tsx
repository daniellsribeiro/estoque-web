"use client";

import { useEffect, useMemo, useState } from "react";
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

const toUpper = (v: FormDataEntryValue | null) => v?.toString().toUpperCase() ?? "";
type CatalogPayload = { nome: string; codigo: string };

export default function ProdutosPage() {
  const [tipos, setTipos] = useState<Option[]>([]);
  const [cores, setCores] = useState<Option[]>([]);
  const [materiais, setMateriais] = useState<Option[]>([]);
  const [tamanhos, setTamanhos] = useState<Option[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | "">("");
  const [showFormCatalog, setShowFormCatalog] = useState(false);
  const [showFormProduct, setShowFormProduct] = useState(false);
  const [showProductTable, setShowProductTable] = useState(false);
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
  const [priceHistory, setPriceHistory] = useState<{
    productId: string;
    rows: { precoAntigo: number; precoNovo: number; createdAt?: string; motivo?: string }[];
  } | null>(null);
  const [priceEditProductId, setPriceEditProductId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState("0,00");
  const [priceCreateInput, setPriceCreateInput] = useState("0,00");

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

  const loadProducts = async () => {
    const data = await apiFetch<Product[]>("/produtos");
    setProducts(data ?? []);
  };

  const loadAll = async () => {
    try {
      setError(null);
      setLoading(true);
      await Promise.all([loadCatalogs(), loadProducts()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateCatalog(path: string, body: CatalogPayload) {
    setError(null);
    if (path === "/produtos/tamanhos") {
      const codigo = toUpper(body.codigo).trim();
      if (!codigo) {
        throw new Error("Informe o código do tamanho");
      }
      body.codigo = codigo.slice(0, 3).padStart(3, "0");
    } else {
      body.codigo = toUpper(body.codigo);
    }
    await apiFetch(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
    await loadCatalogs();
  }

  async function handleDeleteCatalog(category: CategoryKey, id: string) {
    await apiFetch(`${categories[category].path}/${id}`, { method: "DELETE" });
    await loadCatalogs();
  }

  async function handleCreateProduct(formData: FormData) {
    const preco = parseCurrency(priceCreateInput);
    if (Number.isNaN(preco) || preco <= 0) {
      setError("Informe um preço de venda válido.");
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
    await apiFetch("/produtos", {
      method: "POST",
      body: JSON.stringify(body),
    });
    await loadProducts();
    setPriceCreateInput("0,00");
  }

  async function handleUpdateProduct(id: string, body: { nome?: string; observacao?: string }) {
    await apiFetch(`/produtos/${id}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    await loadProducts();
  }

  async function handleDeleteProduct(id: string) {
    await apiFetch(`/produtos/${id}`, { method: "DELETE" });
    await loadProducts();
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

  function openPriceEditor(productId: string) {
    const current = products.find((p) => p.id === productId)?.preco?.precoVendaAtual ?? 0;
    const initial = formatCurrency(Math.round(current * 100).toString());
    setPriceEditProductId(productId);
    setPriceInput(initial);
    setError(null);
  }

  async function handleSavePrice() {
    if (!priceEditProductId) return;
    const value = parseCurrency(priceInput);
    if (Number.isNaN(value) || value <= 0) {
      setError("Informe um valor numérico maior que zero.");
      return;
    }
    await apiFetch(`/produtos/${priceEditProductId}/preco`, {
      method: "POST",
      body: JSON.stringify({ precoVendaAtual: value }),
    });
    setPriceEditProductId(null);
    await loadProducts();
    setError(null);
  }

  async function loadPriceHistory(productId: string) {
    const rows = await apiFetch<{ precoAntigo: number; precoNovo: number; createdAt?: string; motivo?: string }[]>(
      `/produtos/${productId}/preco/historico`,
    );
    setPriceHistory({ productId, rows });
  }

  const filteredProducts = products.filter((p) => {
    const term = filtersProduct.search.toLowerCase();
    const matchesTerm =
      p.nome.toLowerCase().includes(term) ||
      p.codigo.toLowerCase().includes(term) ||
      (p.observacao ?? "").toLowerCase().includes(term);
    const matchesTipo = !filtersProduct.tipo || p.tipo?.id === filtersProduct.tipo;
    const matchesCor = !filtersProduct.cor || p.cor?.id === filtersProduct.cor;
    const matchesMaterial = !filtersProduct.material || p.material?.id === filtersProduct.material;
    const matchesTamanho = !filtersProduct.tamanho || p.tamanho?.id === filtersProduct.tamanho;
    return matchesTerm && matchesTipo && matchesCor && matchesMaterial && matchesTamanho;
  });

  return (
    <ProtectedShell title="Produtos" subtitle="Catálogo e Cadastro">
      {error && (
        <div className="mb-4 rounded-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-500/40">
          {error}
        </div>
      )}

      <div className="rounded-xl bg-slate-900/70 p-6 ring-1 ring-slate-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-50">Produtos</h3>
            <p className="text-sm text-slate-400">Lista principal com filtros por coluna.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowFormProduct((v) => !v)}
              className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow hover:bg-cyan-400 transition"
            >
              {showFormProduct ? "Fechar" : "Adicionar produto"}
            </button>
            <button
              onClick={() => setShowProductTable((v) => !v)}
              className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-cyan-400 transition"
            >
              {showProductTable ? "Ocultar lista" : "Mostrar lista"}
            </button>
          </div>
        </div>

        {showFormProduct && (
          <form
            className="mt-4 grid gap-3 text-sm md:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                await handleCreateProduct(fd);
                (e.target as HTMLFormElement).reset();
                setShowFormProduct(false);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Erro ao salvar produto");
              }
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
            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full rounded-lg bg-cyan-400 px-3 py-2 font-semibold text-slate-900 transition hover:bg-cyan-300"
              >
                Salvar produto
              </button>
            </div>
          </form>
        )}

        <div
          className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6"
          style={{ display: showProductTable ? "grid" : "none" }}
        >
          <input
            value={filtersProduct.search}
            onChange={(e) => setFiltersProduct((p) => ({ ...p, search: e.target.value }))}
            placeholder="Filtrar por nome/código/observação"
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

        <div
          className="mt-4 overflow-auto rounded-lg border border-slate-800 bg-slate-900/50"
          style={{ display: showProductTable ? "block" : "none" }}
        >
          <table className="min-w-full text-sm text-slate-200">
            <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Cor</th>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3">Tamanho</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Observação</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-3 text-center text-slate-400">
                    Carregando...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-3 text-center text-slate-400">
                    Nenhum produto encontrado
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="border-t border-slate-800">
                    <td className="px-4 py-2">{p.codigo}</td>
                    <td className="px-4 py-2">{p.nome}</td>
                    <td className="px-4 py-2">{p.tipo?.nome ?? "-"}</td>
                  <td className="px-4 py-2">{p.cor?.nome ?? "-"}</td>
                  <td className="px-4 py-2">{p.material?.nome ?? "-"}</td>
                  <td className="px-4 py-2">{p.tamanho?.nome ?? "-"}</td>
                  <td className="px-4 py-2">
                    {p.preco?.precoVendaAtual !== undefined
                      ? `R$ ${p.preco.precoVendaAtual.toFixed(2)}`
                      : "-"}
                  </td>
                  <td className="px-4 py-2">{p.observacao ?? "-"}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                        onClick={() => setEditingProduct(p)}
                      >
                        Editar
                      </button>
                      <button
                        className="rounded-lg bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-600 transition hover:bg-slate-600"
                        onClick={() => openPriceEditor(p.id)}
                      >
                        Preço
                      </button>
                      <button
                        className="rounded-lg bg-slate-600 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-500 transition hover:bg-slate-500"
                        onClick={() => loadPriceHistory(p.id)}
                      >
                        Histórico
                      </button>
                      <button
                        className="rounded-lg bg-rose-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-rose-400"
                        onClick={async () => {
                          if (!confirm("Excluir produto? Estoque deve ser 0 e o item não pode estar em uso.")) return;
                          try {
                              await handleDeleteProduct(p.id);
                              window.dispatchEvent(new CustomEvent("api-error", { detail: "Produto excluído com sucesso" }));
                            } catch (err) {
                              const message = err instanceof Error ? err.message : "Erro ao excluir produto";
                              window.dispatchEvent(new CustomEvent("api-error", { detail: message }));
                            }
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {priceEditProductId && (
          <div className="mt-4 rounded-xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-50">Atualizar preço</p>
                <p className="text-xs text-slate-400">Valor monetário com máscara</p>
              </div>
              <button
                className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                onClick={() => setPriceEditProductId(null)}
              >
                Cancelar
              </button>
            </div>
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
                className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300"
              >
                Salvar preço
              </button>
            </div>
          </div>
        )}

        {priceHistory && (
          <div className="mt-4 rounded-xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-50">Histórico de preços</p>
                <p className="text-xs text-slate-400">Produto selecionado</p>
              </div>
              <button
                className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                onClick={() => setPriceHistory(null)}
              >
                Fechar
              </button>
            </div>
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
          </div>
        )}

        {editingProduct && (
          <ProductEditForm
            product={editingProduct}
            onCancel={() => setEditingProduct(null)}
            onSave={handleUpdateProduct}
            onSaved={async () => {
              setEditingProduct(null);
              await loadProducts();
            }}
            onError={(msg) => setError(msg)}
          />
        )}
      </div>

      <div className="mt-6 rounded-xl bg-slate-900/70 p-6 ring-1 ring-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-50">Gerenciar catálogos</h3>
            <p className="text-sm text-slate-400">Tipos, cores, materiais e tamanhos</p>
          </div>
          <button
            onClick={() => {
              setSelectedCategory(selectedCategory || "tipos");
              setShowFormCatalog((v) => !v);
            }}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 ring-1 ring-slate-700 transition hover:bg-slate-700"
          >
            {showFormCatalog ? "Ocultar" : "Mostrar"}
          </button>
        </div>

        {showFormCatalog && (
          <div className="mt-4 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2">
                {(Object.keys(categories) as CategoryKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedCategory(key);
                      setFilter("");
                      setShowFormProduct(false);
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
            <div className="rounded-xl bg-slate-900/60 p-4 text-sm text-slate-300 ring-1 ring-slate-800">
              <p className="font-semibold text-slate-100">Dicas</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Cadastre os catálogos antes de criar produtos.</li>
                <li>Use filtros para localizar itens rapidamente.</li>
                <li>Exclusão só ocorre se o item não estiver em uso.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </ProtectedShell>
  );
}

type ProductEditFormProps = {
  product: Product;
  onCancel: () => void;
  onSave: (id: string, body: { nome?: string; observacao?: string }) => Promise<void>;
  onSaved: () => void;
  onError: (message: string) => void;
};

function ProductEditForm({ product, onCancel, onSave, onSaved, onError }: ProductEditFormProps) {
  const [nome, setNome] = useState(product.nome);
  const [observacao, setObservacao] = useState(product.observacao ?? "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setNome(product.nome);
    setObservacao(product.observacao ?? "");
  }, [product]);

  return (
    <div className="mt-4 rounded-xl bg-slate-900/70 p-4 ring-1 ring-slate-800">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-100">Editar produto</p>
          <p className="text-xs text-slate-400">Atualize nome ou observação</p>
        </div>
        <button
          className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>

      <form
        className="mt-3 grid gap-3 text-sm md:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            setSubmitting(true);
            await onSave(product.id, { nome, observacao });
            onSaved();
          } catch (err) {
            const message = err instanceof Error ? err.message : "Erro ao atualizar produto";
            onError(message);
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          maxLength={30}
          placeholder="Nome"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
        />
        <input
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          maxLength={30}
          placeholder="Observação"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
        />
        <div className="md:col-span-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
          >
            Fechar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-70"
          >
            {submitting ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}

type FormField = { name: string; label: string; required?: boolean; maxLength?: number };

type FormCardProps = {
  fields: FormField[];
  onSubmit: (fd: FormData) => Promise<void>;
  onSubmitted?: () => void;
};

function FormCard({ fields, onSubmit, onSubmitted }: FormCardProps) {
  return (
    <form
      className="space-y-2 text-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await onSubmit(fd);
        (e.target as HTMLFormElement).reset();
        onSubmitted?.();
      }}
    >
      {fields.map((field) => (
        <input
          key={field.name}
          name={field.name}
          required={field.required}
          placeholder={field.label}
          maxLength={field.maxLength}
          defaultValue=""
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
        />
      ))}
      <button
        type="submit"
        className="w-full rounded-lg bg-cyan-400 px-3 py-2 font-semibold text-slate-900 transition hover:bg-cyan-300"
      >
        Salvar
      </button>
    </form>
  );
}

type CategoryManagerProps = {
  category: CategoryKey;
  categories: Record<CategoryKey, { label: string; desc: string; fields: FormField[]; path: string }>;
  data: { tipos: Option[]; cores: Option[]; materiais: Option[]; tamanhos: Option[] };
  loading: boolean;
  filter: string;
  onFilterChange: (v: string) => void;
  onCreate: (path: string, body: CatalogPayload) => Promise<void>;
  onDelete: (category: CategoryKey, id: string) => Promise<void>;
  formKey: number;
};

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
}: CategoryManagerProps) {
  const list = data[category];
  const filtered = list.filter((item) => {
    const term = filter.toLowerCase();
    return item.nome.toLowerCase().includes(term) || (item.codigo ?? "").toLowerCase().includes(term);
  });

  return (
    <div className="mt-4 rounded-xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-base font-semibold text-slate-50">{categories[category].label}</h4>
          <p className="text-xs text-slate-400">{categories[category].desc}</p>
        </div>
        <input
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Filtrar"
          className="w-48 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400"
        />
      </div>

      <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-800 bg-slate-900/50 text-sm text-slate-200">
        {loading ? (
          <div className="p-3 text-slate-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-3 text-slate-400">Nenhum cadastro</div>
        ) : (
          <ul>
            {filtered.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between border-b border-slate-800 px-3 py-2 last:border-0"
              >
                <div>
                  <div className="font-semibold text-slate-50">{item.nome}</div>
                  {item.codigo && <div className="text-xs text-slate-400">Código: {item.codigo}</div>}
                </div>
                <button
                  onClick={async () => {
                    if (!confirm("Excluir este registro?")) return;
                    try {
                      await onDelete(category, item.id);
                      window.dispatchEvent(new CustomEvent("api-error", { detail: "Excluído com sucesso" }));
                    } catch (err) {
                      const message = err instanceof Error ? err.message : "Erro ao excluir";
                      window.dispatchEvent(new CustomEvent("api-error", { detail: message }));
                    }
                  }}
                  className="rounded-lg bg-rose-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-rose-400"
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <FormCard
          key={`${category}-${formKey}`}
          fields={categories[category].fields}
          onSubmit={(fd) =>
            onCreate(categories[category].path, {
              nome: (fd.get("nome") ?? "").toString(),
              codigo: toUpper(fd.get("codigo")),
            })
          }
        />
      </div>
    </div>
  );
}

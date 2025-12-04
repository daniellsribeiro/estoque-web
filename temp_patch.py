import pathlib
p=pathlib.Path("src/app/produtos/page.tsx")
data=p.read_text(encoding="utf-8")
start=data.index("{showProductTable && (")
end=data.index("        {priceEditProductId", start)
new_block="""        {showProductTable && (
          <>
            <div className=\"mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6\">
              <input
                value={filtersProduct.search}
                onChange={(e) => setFiltersProduct((p) => ({ ...p, search: e.target.value }))}
                placeholder=\"Filtrar por nome/codigo/observacao\"
                className=\"rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400 md:col-span-2 xl:col-span-2\"
              />
              <select
                value={filtersProduct.tipo}
                onChange={(e) => setFiltersProduct((p) => ({ ...p, tipo: e.target.value }))}
                className=\"rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400\"
              >
                <option value=\"\">Tipo</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
              <select
                value={filtersProduct.cor}
                onChange={(e) => setFiltersProduct((p) => ({ ...p, cor: e.target.value }))}
                className=\"rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400\"
              >
                <option value=\"\">Cor</option>
                {cores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <select
                value={filtersProduct.material}
                onChange={(e) => setFiltersProduct((p) => ({ ...p, material: e.target.value }))}
                className=\"rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400\"
              >
                <option value=\"\">Material</option>
                {materiais.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
              <select
                value={filtersProduct.tamanho}
                onChange={(e) => setFiltersProduct((p) => ({ ...p, tamanho: e.target.value }))}
                className=\"rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400\"
              >
                <option value=\"\">Tamanho</option>
                {tamanhos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className=\"mt-4 overflow-auto rounded-lg border border-slate-800 bg-slate-900/50\">
              <table className=\"min-w-full text-sm text-slate-200\">
                <thead className=\"bg-slate-900/70 text-left text-xs uppercase text-slate-400\">
                  <tr>
                    <th className=\"px-4 py-3\">Codigo</th>
                    <th className=\"px-4 py-3\">Nome</th>
                    <th className=\"px-4 py-3\">Tipo</th>
                    <th className=\"px-4 py-3\">Cor</th>
                    <th className=\"px-4 py-3\">Material</th>
                    <th className=\"px-4 py-3\">Tamanho</th>
                    <th className=\"px-4 py-3\">Preco</th>
                    <th className=\"px-4 py-3\">Observacao</th>
                    <th className=\"px-4 py-3 text-right\">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className=\"px-4 py-3 text-center text-slate-400\">
                        Carregando...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className=\"px-4 py-3 text-center text-slate-400\">
                        Nenhum produto encontrado
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => (
                      <tr key={p.id} className=\"border-t border-slate-800\">
                        <td className=\"px-4 py-2\">{p.codigo}</td>
                        <td className=\"px-4 py-2\">{p.nome}</td>
                        <td className=\"px-4 py-2\">{p.tipo?.nome ?? \"-\"}</td>
                        <td className=\"px-4 py-2\">{p.cor?.nome ?? \"-\"}</td>
                        <td className=\"px-4 py-2\">{p.material?.nome ?? \"-\"}</td>
                        <td className=\"px-4 py-2\">{p.tamanho?.nome ?? \"-\"}</td>
                        <td className=\"px-4 py-2\">
                          {p.preco?.precoVendaAtual !== undefined
                            ? `R$ ${p.preco.precoVendaAtual.toFixed(2)}`
                            : \"-\"}
                        </td>
                        <td className=\"px-4 py-2\">{p.observacao ?? \"-\"}</td>
                        <td className=\"px-4 py-2 text-right\">
                          <div className=\"flex justify-end gap-2\">
                            <button
                              className=\"rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700\"
                              onClick={() => setEditingProduct(p)}
                            >
                              Editar
                            </button>
                            <button
                              className=\"rounded-lg bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-600 transition hover:bg-slate-600\"
                              onClick={() => openPriceEditor(p.id)}
                            >
                              Preco
                            </button>
                            <button
                              className=\"rounded-lg bg-slate-600 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-500 transition hover:bg-slate-500\"
                              onClick={() => loadPriceHistory(p.id)}
                            >
                              Historico
                            </button>
                            <button
                              className=\"rounded-lg bg-rose-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-rose-400\"
                              onClick={async () => {
                                if (!confirm(\\\"Excluir produto? Estoque deve ser 0 e o item nao pode estar em uso.\\\")) return;
                                try {
                                  await handleDeleteProduct(p.id);
                                  window.dispatchEvent(new CustomEvent(\\\"api-error\\\", { detail: \\\"Produto excluido com sucesso\\\" }));
                                } catch (err) {
                                  const message = err instanceof Error ? err.message : \\\"Erro ao excluir produto\\\";
                                  window.dispatchEvent(new CustomEvent(\\\"api-error\\\", { detail: message }));
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
          </>
        )}
"""
new_data=data[:start]+new_block+data[end:]
p.write_text(new_data, encoding="utf-8")

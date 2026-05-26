'use client'
import { useEffect, useState } from 'react'
import { Shield, CheckCircle, XCircle, Eye, X } from 'lucide-react'
import { adminApi, AdminKycUser, AdminKycDoc } from '@/lib/api'

const DOC_LABELS: Record<string, string> = {
  id_card:       "Carte d'identite",
  selfie:        'Selfie',
  proof_address: 'Domicile',
}

const STATUS_COLORS: Record<string, string> = {
  pending:  'bg-yellow-50 text-yellow-600',
  verified: 'bg-green-50 text-green-600',
  none:     'bg-gray-100 text-gray-500',
}

export default function AdminKYCPage() {
  const [users, setUsers]   = useState<AdminKycUser[]>([])
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  // Viewer
  const [viewUser, setViewUser]   = useState<AdminKycUser | null>(null)
  const [docs, setDocs]           = useState<AdminKycDoc[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<AdminKycDoc | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await adminApi.kycList(page)
      setUsers(res.items)
      setTotal(res.total)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  async function openViewer(u: AdminKycUser) {
    setViewUser(u)
    setDocs([])
    setSelectedDoc(null)
    setDocsLoading(true)
    try {
      setDocs(await adminApi.kycDocs(u.id))
    } finally {
      setDocsLoading(false)
    }
  }

  async function handleApprove(userId: string) {
    if (!confirm('Approuver ce KYC ?')) return
    setActionId(userId + '-approve')
    try {
      await adminApi.kycApprove(userId)
      await load()
      if (viewUser?.id === userId) {
        setViewUser((u) => u ? { ...u, kycStatus: 'verified' } : u)
      }
    } catch (e) { alert((e as Error).message) }
    finally { setActionId(null) }
  }

  async function handleReject(userId: string) {
    if (!confirm('Rejeter et supprimer les documents ?')) return
    setActionId(userId + '-reject')
    try {
      await adminApi.kycReject(userId)
      await load()
      setViewUser(null)
    } catch (e) { alert((e as Error).message) }
    finally { setActionId(null) }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-navy">Verifications KYC</h1>
        <p className="text-gray-500 text-sm mt-0.5">{total} utilisateur{total !== 1 ? 's' : ''} avec KYC soumis</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Utilisateur</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Statut</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Documents</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Date</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${50 + j * 10}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-gray-400 text-sm">
                    Aucun KYC en attente
                  </td>
                </tr>
              ) : users.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-navy">{u.phone}</p>
                    {u.name && <p className="text-xs text-gray-400">{u.name}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[u.kycStatus]}`}>
                      {u.kycStatus === 'verified' ? 'Verifie' : u.kycStatus === 'pending' ? 'En attente' : 'Aucun'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      {(u.docs || []).map((d) => (
                        <span key={d.type} className={`text-xs px-1.5 py-0.5 rounded ${
                          d.verified ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                        }`}>
                          {DOC_LABELS[d.type] || d.type}
                        </span>
                      ))}
                      {(!u.docs || u.docs.length === 0) && <span className="text-gray-300 text-xs">—</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">{u.createdAt}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openViewer(u)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-navy/10 text-navy text-xs font-semibold rounded-lg hover:bg-navy/20"
                      >
                        <Eye size={11} /> Voir
                      </button>
                      {u.kycStatus === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(u.id)}
                            disabled={actionId === u.id + '-approve'}
                            className="flex items-center gap-1 px-2.5 py-1 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50"
                          >
                            <CheckCircle size={11} />
                            {actionId === u.id + '-approve' ? '...' : 'Approuver'}
                          </button>
                          <button
                            onClick={() => handleReject(u.id)}
                            disabled={actionId === u.id + '-reject'}
                            className="flex items-center gap-1 px-2.5 py-1 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 disabled:opacity-50"
                          >
                            <XCircle size={11} />
                            {actionId === u.id + '-reject' ? '...' : 'Rejeter'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > 20 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">Page {page} sur {Math.ceil(total / 20)}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                Precedent
              </button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Document viewer modal */}
      {viewUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="font-bold text-navy">{viewUser.phone}</p>
                {viewUser.name && <p className="text-xs text-gray-400">{viewUser.name}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[viewUser.kycStatus]}`}>
                  <Shield size={11} className="inline mr-1" />
                  {viewUser.kycStatus === 'verified' ? 'Verifie' : viewUser.kycStatus === 'pending' ? 'En attente' : 'Non verifie'}
                </span>
                <button onClick={() => setViewUser(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-5">
              {docsLoading && (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm animate-pulse">
                  Chargement des documents...
                </div>
              )}

              {!docsLoading && docs.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-10">Aucun document soumis</p>
              )}

              {!docsLoading && docs.length > 0 && (
                <div className="space-y-4">
                  {/* Doc thumbnails */}
                  <div className="flex gap-3 flex-wrap">
                    {docs.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDoc(selectedDoc?.id === d.id ? null : d)}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-colors ${
                          selectedDoc?.id === d.id ? 'border-navy' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={d.fileUrl}
                          alt={DOC_LABELS[d.type]}
                          className="w-20 h-16 object-cover rounded-lg"
                        />
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          d.verified ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                        }`}>
                          {DOC_LABELS[d.type] || d.type}
                        </span>
                        <span className="text-xs text-gray-400">{d.uploadedAt}</span>
                      </button>
                    ))}
                  </div>

                  {/* Full-size selected doc */}
                  {selectedDoc && (
                    <div className="rounded-xl overflow-hidden border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedDoc.fileUrl}
                        alt={DOC_LABELS[selectedDoc.type]}
                        className="w-full max-h-80 object-contain bg-gray-50"
                      />
                      <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500">
                        {DOC_LABELS[selectedDoc.type]} — soumis le {selectedDoc.uploadedAt}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {viewUser.kycStatus === 'pending' && (
              <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => handleApprove(viewUser.id)}
                  disabled={!!actionId}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white font-bold py-2.5 rounded-xl hover:bg-green-600 disabled:opacity-50"
                >
                  <CheckCircle size={16} />
                  {actionId === viewUser.id + '-approve' ? 'Approbation...' : 'Approuver le KYC'}
                </button>
                <button
                  onClick={() => handleReject(viewUser.id)}
                  disabled={!!actionId}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white font-bold py-2.5 rounded-xl hover:bg-red-600 disabled:opacity-50"
                >
                  <XCircle size={16} />
                  {actionId === viewUser.id + '-reject' ? 'Rejet...' : 'Rejeter'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  ArrowLeft, RefreshCw, LogOut, Cpu, HardDrive, MemoryStick,
  Wifi, WifiOff, Play, BookTemplate, X, ChevronRight, Loader2,
} from 'lucide-react';
import { AgentSession, GoldenTemplate } from '@/types';

function StatusDot({ status }: { status: AgentSession['status'] }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-400' : 'bg-slate-600'}`} />
  );
}

function MetricBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span>{value.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 sticky top-0 bg-slate-800">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}д ${h}ч`;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

export default function AgentsPage() {
  const router = useRouter();
  const { user, logout, init } = useAuth();
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [templates, setTemplates] = useState<GoldenTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AgentSession | null>(null);
  const [applyingSlug, setApplyingSlug] = useState<string | null>(null);
  const [showProvision, setShowProvision] = useState(false);
  const [provision, setProvision] = useState({
    email: '', password: '', firstName: '', lastName: '', phone: '',
    city: '', serverName: '', subdomain: '',
  });
  const [provisioning, setProvisioning] = useState(false);
  const [provisionResult, setProvisionResult] = useState<any>(null);

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (user && user.role !== 'admin') router.push('/auth/login');
    if (user) load();
  }, [user, router]);

  const load = async () => {
    setLoading(true);
    try {
      const [sessRes, tplRes] = await Promise.all([
        api.get<AgentSession[]>('/tinta-core/sessions'),
        api.get<GoldenTemplate[]>('/tinta-core/templates'),
      ]);
      setSessions(sessRes.data);
      setTemplates(tplRes.data);
    } catch { toast.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  };

  const applyTemplate = async (clientId: string, slug: string) => {
    setApplyingSlug(slug);
    try {
      const { data } = await api.post(`/tinta-core/template/${clientId}/${slug}`);
      if (data.sent) toast.success(`Шаблон «${slug}» применён`);
      else toast.info('Агент офлайн — шаблон будет применён при подключении');
      await load();
    } catch { toast.error('Ошибка применения шаблона'); }
    finally { setApplyingSlug(null); }
  };

  const provisionClient = async () => {
    setProvisioning(true);
    try {
      const { data } = await api.post('/provisioning/client', provision);
      setProvisionResult(data);
      toast.success('Клиент провижинен!');
      await load();
    } catch (e: any) {
      const msg = e.response?.data?.message;
      toast.error(msg === 'Email already exists' ? 'Email уже занят' : 'Ошибка провиженинга');
    } finally { setProvisioning(false); }
  };

  if (!user) return null;

  const connected = sessions.filter(s => s.status === 'connected').length;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard/admin')} className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft size={18} />
            </button>
            <span className="font-semibold">Tinta Lab</span>
            <span className="text-slate-500 text-sm">/ Admin / Агенты</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowProvision(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors"
            >
              <Play size={13} /> Новый клиент
            </button>
            <button onClick={load} className="text-slate-400 hover:text-white transition-colors">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => logout()} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm">
              <LogOut size={15} /> Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Tinta Agents</h1>
          <p className="text-slate-400 text-sm mt-1">
            {sessions.length} клиентов · <span className="text-green-400">{connected} онлайн</span>
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 size={24} className="animate-spin mr-2" /> Загрузка...
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Wifi size={40} className="mx-auto mb-3 opacity-30" />
            <p>Нет агентов. Нажмите «Новый клиент» чтобы провижинить первого.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sessions.map(s => (
              <div
                key={s.id}
                onClick={() => setSelected(s)}
                className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 hover:border-slate-600 hover:bg-slate-800 transition-all cursor-pointer group"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <StatusDot status={s.status} />
                    <span className="font-medium text-sm">
                      {s.client?.user ? `${s.client.user.firstName} ${s.client.user.lastName}` : s.clientId.slice(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {s.status === 'connected'
                      ? <Wifi size={14} className="text-green-400" />
                      : <WifiOff size={14} className="text-slate-600" />
                    }
                    <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                </div>

                {/* Agent/HA versions */}
                <div className="flex gap-2 mb-4">
                  {s.agentVersion && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      Agent {s.agentVersion}
                    </span>
                  )}
                  {s.haVersion && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      HA {s.haVersion}
                    </span>
                  )}
                </div>

                {/* Metrics */}
                {s.metrics ? (
                  <div className="space-y-2">
                    <MetricBar value={s.metrics.cpuPercent} label="CPU" color="bg-teal-500" />
                    <MetricBar value={s.metrics.memPercent} label="RAM" color="bg-blue-500" />
                    <MetricBar value={s.metrics.diskPercent} label="Диск" color="bg-purple-500" />
                    <div className="flex justify-between text-xs text-slate-500 pt-1">
                      <span>{s.metrics.deviceCount} устройств</span>
                      <span>{s.metrics.automationCount} автоматизаций</span>
                      <span>↑{formatUptime(s.metrics.uptimeSeconds)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-600 flex items-center gap-1.5">
                    <Cpu size={12} /> Метрики недоступны
                  </div>
                )}

                {/* Templates applied */}
                {s.appliedTemplates.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700/50">
                    <div className="text-xs text-slate-500">{s.appliedTemplates.length} шаблонов применено</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Agent detail modal */}
      {selected && (
        <Modal
          title={selected.client?.user ? `${selected.client.user.firstName} ${selected.client.user.lastName}` : selected.clientId}
          onClose={() => setSelected(null)}
        >
          <div className="space-y-5">
            {/* Status */}
            <div className="bg-slate-900/50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Статус</span>
                <span className={selected.status === 'connected' ? 'text-green-400' : 'text-slate-500'}>
                  {selected.status === 'connected' ? 'Онлайн' : 'Офлайн'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Client ID</span>
                <span className="text-slate-300 font-mono text-xs">{selected.clientId}</span>
              </div>
              {selected.agentVersion && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Версия агента</span>
                  <span className="text-slate-300">{selected.agentVersion}</span>
                </div>
              )}
              {selected.haVersion && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Home Assistant</span>
                  <span className="text-slate-300">{selected.haVersion}</span>
                </div>
              )}
              {selected.lastHeartbeatAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Последний heartbeat</span>
                  <span className="text-slate-300 text-xs">
                    {new Date(selected.lastHeartbeatAt).toLocaleString('de-DE')}
                  </span>
                </div>
              )}
            </div>

            {/* Metrics */}
            {selected.metrics && (
              <div>
                <div className="text-xs text-slate-400 mb-2">Метрики системы</div>
                <div className="bg-slate-900/50 rounded-xl p-4 space-y-3">
                  <MetricBar value={selected.metrics.cpuPercent} label="CPU" color="bg-teal-500" />
                  <MetricBar value={selected.metrics.memPercent} label="RAM" color="bg-blue-500" />
                  <MetricBar value={selected.metrics.diskPercent} label="Диск" color="bg-purple-500" />
                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-700/50">
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">{selected.metrics.deviceCount}</div>
                      <div className="text-xs text-slate-500">устройств</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">{selected.metrics.automationCount}</div>
                      <div className="text-xs text-slate-500">автоматиз.</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">{formatUptime(selected.metrics.uptimeSeconds)}</div>
                      <div className="text-xs text-slate-500">uptime</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Golden Templates */}
            <div>
              <div className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
                <BookTemplate size={12} /> Golden Templates
              </div>
              <div className="space-y-2">
                {templates.map(t => {
                  const applied = selected.appliedTemplates.includes(t.slug);
                  return (
                    <div
                      key={t.slug}
                      className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-medium">{t.name}</div>
                        {t.description && <div className="text-xs text-slate-500 mt-0.5">{t.description}</div>}
                      </div>
                      {applied ? (
                        <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                          Применён
                        </span>
                      ) : (
                        <button
                          onClick={() => applyTemplate(selected.clientId, t.slug)}
                          disabled={applyingSlug === t.slug}
                          className="text-xs px-2 py-0.5 rounded-full bg-teal-600 hover:bg-teal-500 text-white transition-colors disabled:opacity-50"
                        >
                          {applyingSlug === t.slug ? <Loader2 size={10} className="animate-spin" /> : 'Применить'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button onClick={() => setSelected(null)} className="w-full py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors">
              Закрыть
            </button>
          </div>
        </Modal>
      )}

      {/* One-Click Provision Modal */}
      {showProvision && (
        <Modal title="Новый клиент — One-Click Provision" onClose={() => { setShowProvision(false); setProvisionResult(null); }}>
          {provisionResult ? (
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-green-400 text-sm font-medium">
                Клиент успешно провижинен
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Client ID</span>
                  <span className="font-mono text-xs text-slate-300">{provisionResult.clientId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Dashboard URL</span>
                  <span className="text-teal-400">{provisionResult.dashboardUrl}</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1.5">Команда установки агента</div>
                <pre className="bg-slate-900 rounded-lg p-3 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">
                  {provisionResult.agentInstallCommand}
                </pre>
              </div>
              <button
                onClick={() => { setShowProvision(false); setProvisionResult(null); setProvision({ email: '', password: '', firstName: '', lastName: '', phone: '', city: '', serverName: '', subdomain: '' }); }}
                className="w-full py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors"
              >
                Готово
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Имя</label>
                  <input value={provision.firstName} onChange={e => setProvision(p => ({ ...p, firstName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm focus:outline-none focus:border-teal-500" placeholder="Макс" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Фамилия</label>
                  <input value={provision.lastName} onChange={e => setProvision(p => ({ ...p, lastName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm focus:outline-none focus:border-teal-500" placeholder="Мюллер" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Email</label>
                <input type="email" value={provision.email} onChange={e => setProvision(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm focus:outline-none focus:border-teal-500" placeholder="max@example.de" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Пароль</label>
                  <input type="password" value={provision.password} onChange={e => setProvision(p => ({ ...p, password: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm focus:outline-none focus:border-teal-500" placeholder="Минимум 8 символов" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Телефон</label>
                  <input value={provision.phone} onChange={e => setProvision(p => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm focus:outline-none focus:border-teal-500" placeholder="+49 151..." />
                </div>
              </div>
              <div className="border-t border-slate-700/50 pt-3">
                <div className="text-xs text-slate-400 mb-2">Сервер / Home Assistant</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Название сервера</label>
                    <input value={provision.serverName} onChange={e => setProvision(p => ({ ...p, serverName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm focus:outline-none focus:border-teal-500" placeholder="HAOS Mueller" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Поддомен</label>
                    <input value={provision.subdomain} onChange={e => setProvision(p => ({ ...p, subdomain: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm focus:outline-none focus:border-teal-500" placeholder="mueller.tinta-lab.de" />
                  </div>
                </div>
              </div>
              <button
                onClick={provisionClient}
                disabled={provisioning || !provision.email || !provision.password || !provision.firstName || !provision.serverName || !provision.subdomain}
                className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {provisioning ? <><Loader2 size={14} className="animate-spin" /> Провижинирую...</> : 'Провижинить клиента'}
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

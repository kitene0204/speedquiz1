import React, { useState } from 'react';
import { Database, Copy, Check, ExternalLink, Zap, AlertCircle, CheckCircle2, ShieldCheck, ArrowRight, Sparkles, Terminal } from 'lucide-react';
import { getStoredSupabaseConfig, saveSupabaseConfig, testSupabaseConnection, SUPABASE_SQL_SCHEMA } from '../lib/supabase';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({ isOpen, onClose, onConfigSaved }) => {
  const currentConfig = getStoredSupabaseConfig();
  const [url, setUrl] = useState(currentConfig.url);
  const [anonKey, setAnonKey] = useState(currentConfig.anonKey);
  const [activeTab, setActiveTab] = useState<'config' | 'sql'>('config');
  const [testStatus, setTestStatus] = useState<{
    loading: boolean;
    success?: boolean;
    needsTables?: boolean;
    message?: string;
  }>({
    loading: false,
  });
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Extract project ID from URL (e.g., https://ofmfkingnhykhwoopnfr.supabase.co -> ofmfkingnhykhwoopnfr)
  const projectId = url.trim().match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || '';
  const sqlEditorDirectUrl = projectId
    ? `https://supabase.com/dashboard/project/${projectId}/sql/new`
    : 'https://supabase.com/dashboard';

  const handleTestAndSave = async () => {
    setTestStatus({ loading: true });
    // Always persist to localStorage so user doesn't retype
    if (url.trim() && anonKey.trim()) {
      saveSupabaseConfig(url, anonKey);
    }
    const result = await testSupabaseConnection(url, anonKey);
    setTestStatus({
      loading: false,
      success: result.success,
      needsTables: result.needsTables,
      message: result.message,
    });

    if (result.success && !result.needsTables) {
      onConfigSaved();
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleGoToSqlTab = () => {
    handleCopySql();
    setActiveTab('sql');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">슈파베이스(Supabase) 백엔드 연동</h3>
              <p className="text-xs text-emerald-100">실시간 데이터베이스 및 Realtime 채널 설정</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-2xl font-light w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'config'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Zap className="w-4 h-4" /> 1단계: API 키 입력
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'sql'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Terminal className="w-4 h-4" /> 2단계: 테이블 생성 SQL 스크립트
            {testStatus.needsTables && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping ml-1" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'config' ? (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-900 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">슈파베이스 연결 안내</p>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    Supabase 프로젝트의 <strong>Project URL</strong>과 <strong>anon public key</strong>를 입력하세요. 키 인증 후 2단계 탭에서 테이블 생성 SQL을 한 번만 실행해주시면 완벽하게 연동됩니다!
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Supabase Project URL
                  </label>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://your-project-id.supabase.co"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Supabase Anon Public API Key
                  </label>
                  <input
                    type="password"
                    value={anonKey}
                    onChange={(e) => setAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Status Message */}
              {testStatus.message && (
                <div
                  className={`p-4 rounded-2xl text-xs flex flex-col gap-3 ${
                    testStatus.needsTables
                      ? 'bg-amber-50 text-amber-900 border-2 border-amber-300'
                      : testStatus.success
                      ? 'bg-green-50 text-green-900 border border-green-200'
                      : 'bg-red-50 text-red-900 border border-red-200'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {testStatus.needsTables ? (
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    ) : testStatus.success ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <p className="font-bold">{testStatus.message}</p>
                      {testStatus.needsTables && (
                        <p className="text-amber-800 leading-relaxed">
                          현재 프로젝트 연결은 정상이며, 퀴즈 데이터를 저장할 <strong>rooms, submissions, players</strong> 테이블이 아직 생성되지 않은 상태입니다.
                        </p>
                      )}
                    </div>
                  </div>

                  {testStatus.needsTables && (
                    <button
                      onClick={handleGoToSqlTab}
                      className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                    >
                      <span>1-클릭 SQL 복사 및 생성 가이드로 이동</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                <a
                  href={sqlEditorDirectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-slate-500 hover:text-emerald-600 flex items-center gap-1 transition-colors"
                >
                  Supabase 대시보드 바로가기 <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2.5 text-sm rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    닫기
                  </button>
                  <button
                    onClick={handleTestAndSave}
                    disabled={testStatus.loading || !url.trim() || !anonKey.trim()}
                    className="px-5 py-2.5 text-sm font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 disabled:opacity-40 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    {testStatus.loading ? (
                      '연결 확인 중...'
                    ) : (
                      <>
                        <Zap className="w-4 h-4" /> 연결 테스트 및 저장
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-5">
              {/* Step by step guide */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-sm text-emerald-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> 30초 만에 테이블 생성하는 초간단 방법
                </h4>
                <ol className="text-xs space-y-2 text-slate-300 list-decimal list-inside leading-relaxed">
                  <li>
                    아래 <strong className="text-amber-300">[SQL 전체 복사하기]</strong> 버튼을 누릅니다.
                  </li>
                  <li>
                    {projectId ? (
                      <a
                        href={sqlEditorDirectUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 rounded-lg font-bold border border-emerald-500/30 mx-1 underline"
                      >
                        내 Supabase SQL Editor 바로 열기 ({projectId}) <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <strong className="text-white">Supabase 대시보드 왼쪽 메뉴의 [SQL Editor]</strong>
                    )}
                    를 엽니다.
                  </li>
                  <li>
                    새 쿼리 창에 붙여넣기(<kbd className="px-1.5 py-0.5 bg-slate-800 rounded-sm border border-slate-700 text-amber-200">Ctrl+V</kbd>) 후, 우측 하단 녹색 <strong className="text-emerald-400">[Run]</strong> 버튼을 누릅니다.
                  </li>
                  <li>
                    다시 이 창의 [1단계: API 키 입력] 탭으로 돌아와 <strong className="text-white">[연결 테스트 및 저장]</strong>을 누르면 🟢 초록불로 완료됩니다!
                  </li>
                </ol>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-700">
                  생성할 테이블: <span className="text-emerald-600 font-mono">rooms</span>, <span className="text-emerald-600 font-mono">submissions</span>, <span className="text-emerald-600 font-mono">players</span>
                </p>
                <button
                  onClick={handleCopySql}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" /> 복사되었습니다!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" /> SQL 전체 복사하기
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 bg-slate-900 text-emerald-400 font-mono text-xs rounded-2xl overflow-x-auto max-h-72 leading-relaxed border border-slate-800 selection:bg-emerald-800">
                  {SUPABASE_SQL_SCHEMA}
                </pre>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => setActiveTab('config')}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  ← API 키 설정으로 돌아가기
                </button>

                <button
                  onClick={() => {
                    setActiveTab('config');
                    handleTestAndSave();
                  }}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer"
                >
                  SQL 실행 완료 후 연결 재확인하기 🔄
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

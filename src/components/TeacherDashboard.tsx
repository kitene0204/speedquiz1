import React, { useState } from 'react';
import { Users, Play, Copy, Check, Eye, EyeOff, Sparkles, PlusCircle, Trash2, Shield, QrCode, Share2 } from 'lucide-react';
import { RoomState, StudentSubmission } from '../types';
import { RealtimeSyncManager } from '../lib/supabase';
import { sounds } from '../lib/sound';

interface TeacherDashboardProps {
  roomState: RoomState;
  syncManager: RealtimeSyncManager;
  onStartGame: () => void;
  onOpenSupabaseModal: () => void;
  isSupabaseConnected: boolean;
}

const SAMPLE_DEMO_SUBMISSIONS: Omit<StudentSubmission, 'id' | 'roomId' | 'submittedAt'>[] = [
  {
    studentName: '이지은',
    avatar: '🐱',
    keywords: ['한라산', '눈보라', '컵라면', '헬기', '발목'],
    story: '겨울 방학 때 가족이랑 한라산 등산하다가 갑자기 폭설이 내려서 대피소에서 헬기 올 때까지 컵라면만 먹었던 추억!',
  },
  {
    studentName: '박준혁',
    avatar: '🎸',
    keywords: ['홍대', '버스킹', '외국인', '기타줄', '박수'],
    story: '친구들이랑 홍대에서 첫 길거리 버스킹을 했는데, 외국인 관광객 분이 기타줄 끊어졌을 때 새 줄을 사다주셨어요!',
  },
  {
    studentName: '최수아',
    avatar: '🎨',
    keywords: ['전국대회', '포스터', '물감쏟음', '대상', '반전'],
    story: '미술대회 10분 전에 그림에 검은 물감을 쏟았는데, 그걸 먹구름으로 수습해서 오히려 심사위원들에게 극찬받고 대상 탐!',
  },
  {
    studentName: '정민호',
    avatar: '🍕',
    keywords: ['피자', '한판혼자', '내기', '소화제', '응급실'],
    story: '친구랑 패밀리 사이즈 피자 한 판 다 먹기 내기했다가 이겼는데 바로 급체해서 밤에 응급실 갔어요...',
  },
];

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  roomState,
  syncManager,
  onStartGame,
  onOpenSupabaseModal,
  isSupabaseConnected,
}) => {
  const [hideNames, setHideNames] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?room=${roomState.pin}&role=student`
    : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyPin = () => {
    navigator.clipboard.writeText(roomState.pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleAddSampleData = () => {
    SAMPLE_DEMO_SUBMISSIONS.forEach((demo, idx) => {
      const sub: StudentSubmission = {
        id: `demo_${Date.now()}_${idx}`,
        roomId: roomState.id,
        studentName: demo.studentName,
        avatar: demo.avatar,
        keywords: demo.keywords,
        story: demo.story,
        submittedAt: Date.now() + idx,
      };
      syncManager.submitKeywords(sub);
      syncManager.sendJoin({
        id: `demo_player_${idx}`,
        name: demo.studentName,
        avatar: demo.avatar,
      });
    });
    sounds.playCorrect();
  };

  const handleDeleteSubmission = (id: string) => {
    const nextSubmissions = roomState.submissions.filter((s) => s.id !== id);
    syncManager.updateRoomState({
      ...roomState,
      submissions: nextSubmissions,
    });
  };

  const totalStudents = roomState.players.length;
  const totalSubmissions = roomState.submissions.length;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Top Banner & Room PIN display */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-semibold backdrop-blur-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                선생님 호스트 화면
              </span>
              <button
                onClick={onOpenSupabaseModal}
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isSupabaseConnected
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-400/30 hover:bg-amber-500/30'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                {isSupabaseConnected ? '슈파베이스 연동됨 🟢' : '슈파베이스 설정 (선택)'}
              </button>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              스피드 키워드 경험 퀴즈 🎯
            </h1>
            <p className="text-indigo-200 text-sm mt-1">
              학생들이 작성한 3~6개의 키워드를 실시간으로 취합하고 누구인지 맞춰보세요!
            </p>
          </div>

          {/* Big Room PIN Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/20 flex flex-col items-center shadow-lg">
            <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-1">
              학생 접속 PIN 번호
            </span>
            <div className="flex items-center gap-3">
              <span className="text-4xl sm:text-5xl font-black font-mono tracking-widest text-amber-300 drop-shadow-md">
                {roomState.pin}
              </span>
              <button
                onClick={handleCopyPin}
                title="PIN 번호 복사"
                className="p-2.5 bg-white/20 hover:bg-white/30 rounded-xl transition-colors cursor-pointer"
              >
                {copiedPin ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5 text-white" />}
              </button>
            </div>

            <div className="flex gap-2 mt-3 w-full">
              <button
                onClick={handleCopyLink}
                className="flex-1 py-1.5 px-3 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                {copiedLink ? '링크 복사됨!' : '초대 링크 복사'}
              </button>
              <button
                onClick={() => setShowQrModal(true)}
                className="py-1.5 px-3 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" /> QR 코드
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Connected stats */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400">접속 중인 학생</p>
            <p className="text-3xl font-black text-slate-800 mt-0.5">{totalStudents}명</p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Submissions stats */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400">키워드 제출 완료</p>
            <p className="text-3xl font-black text-emerald-600 mt-0.5">{totalSubmissions}개</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

        {/* Name Privacy Toggle */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400">화면 공개 모드</p>
            <p className="text-sm font-bold text-slate-700 mt-1">
              {hideNames ? '이름 가림 (프로젝터용)' : '이름 표시 중'}
            </p>
          </div>
          <button
            onClick={() => setHideNames(!hideNames)}
            className={`p-3 rounded-2xl transition-colors cursor-pointer ${
              hideNames ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
            }`}
            title="프로젝터 공유 시 스포일러 방지"
          >
            {hideNames ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
          </button>
        </div>

        {/* Quick Demo Seed */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400">테스트 시연용</p>
            <button
              onClick={handleAddSampleData}
              className="text-xs font-bold text-amber-600 hover:text-amber-700 underline mt-1 flex items-center gap-1 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" /> 샘플 4명 즉시 추가
            </button>
          </div>
          <button
            onClick={handleAddSampleData}
            className="p-3 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-2xl transition-colors cursor-pointer"
            title="테스트용 학생 4명 키워드 추가"
          >
            <Sparkles className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Start Game Action Banner */}
      <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-800">
            {totalSubmissions > 0
              ? `총 ${totalSubmissions}명의 특별한 경험 키워드가 취합되었습니다!`
              : '학생들이 키워드를 제출하기를 기다리고 있습니다.'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {totalSubmissions > 0
              ? '게임을 시작하면 큰 화면에서 힌트가 하나씩 공개되며 학생들이 버저를 누릅니다.'
              : '학생들에게 위 PIN 번호 또는 접속 링크를 전달해 키워드를 3~6개 적게 해주세요.'}
          </p>
        </div>

        <button
          onClick={onStartGame}
          disabled={totalSubmissions === 0}
          className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white font-black text-base shadow-xl shadow-teal-700/25 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-40 disabled:cursor-not-allowed active:scale-98 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
        >
          <Play className="w-5 h-5 fill-white" />
          스피드 게임 시작하기 ({totalSubmissions}문제)
        </button>
      </div>

      {/* Real-time Submissions Grid */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-800">실시간 취합된 학생 키워드 현황</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
              {totalSubmissions}건
            </span>
          </div>

          <button
            onClick={() => setHideNames(!hideNames)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {hideNames ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {hideNames ? '이름 보기' : '이름 숨기기'}
          </button>
        </div>

        {totalSubmissions === 0 ? (
          <div className="text-center py-16 px-4 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl">
              ✍️
            </div>
            <h4 className="text-base font-bold text-slate-700">아직 제출된 키워드가 없습니다</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              학생들이 모바일이나 PC로 3~6개의 경험 키워드를 입력하면 여기에 실시간으로 나타납니다.
            </p>
            <button
              onClick={handleAddSampleData}
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              샘플 키워드 데이터로 테스트해보기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roomState.submissions.map((sub, index) => (
              <div
                key={sub.id}
                className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:shadow-md transition-all relative group"
              >
                {/* Author Info */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl p-1.5 bg-white rounded-xl shadow-xs border border-slate-100">
                      {sub.avatar}
                    </span>
                    <div>
                      <span className="text-[11px] font-bold text-slate-400">#{index + 1}번째 경험</span>
                      <h4 className="font-bold text-slate-800 text-sm">
                        {hideNames ? '🔒 비밀의 주인공' : sub.studentName}
                      </h4>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteSubmission(sub.id)}
                    title="제출물 삭제"
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Keywords Chips */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {sub.keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-xl bg-amber-100/80 text-amber-900 font-bold text-xs border border-amber-200/50"
                    >
                      #{kw}
                    </span>
                  ))}
                </div>

                {/* Story Preview */}
                {sub.story && (
                  <p className="text-xs text-slate-500 bg-white p-2.5 rounded-xl border border-slate-100 italic line-clamp-2">
                    "{sub.story}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl border border-slate-200">
            <h3 className="text-xl font-black text-slate-800 mb-1">학생 모바일 간편 접속</h3>
            <p className="text-xs text-slate-500 mb-4">카메라로 QR을 스캔하거나 링크로 접속하세요</p>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-4 flex justify-center">
              {/* Dynamic QR API representation */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}`}
                alt="Room QR Code"
                className="w-48 h-48 rounded-xl"
              />
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs font-bold text-amber-900 mb-4">
              접속 PIN: <span className="font-mono text-base font-black">{roomState.pin}</span>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-900 cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

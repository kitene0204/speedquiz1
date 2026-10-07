import React, { useState, useEffect, useMemo } from 'react';
import { Volume2, VolumeX, Shield, Users, Presentation, Database, Sparkles } from 'lucide-react';
import { RoomState } from './types';
import { RealtimeSyncManager, getStoredSupabaseConfig, testSupabaseConnection } from './lib/supabase';
import { TeacherDashboard } from './components/TeacherDashboard';
import { SpeedGameHost } from './components/SpeedGameHost';
import { StudentView } from './components/StudentView';
import { SupabaseModal } from './components/SupabaseModal';
import { sounds } from './lib/sound';

export default function App() {
  // Query param parsing for quick join links e.g. ?room=5821&role=student
  const searchParams = useMemo(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  }, []);

  const initialRole = searchParams.get('role') === 'student' ? 'student' : 'teacher';
  const initialPin = searchParams.get('room') || '5821';

  const [role, setRole] = useState<'teacher' | 'student'>(initialRole);
  const [roomPin, setRoomPin] = useState(initialPin);
  const [isMuted, setIsMuted] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);

  // Initial Room State
  const [roomState, setRoomState] = useState<RoomState>({
    id: roomPin,
    pin: roomPin,
    teacherName: '선생님',
    title: '스피드 키워드 경험 퀴즈',
    status: 'waiting',
    currentQuizIndex: 0,
    revealedKeywordCount: 1,
    timerSeconds: 30,
    isTimerRunning: false,
    submissions: [],
    players: [],
    activeBuzzer: null,
    lastGuessResult: null,
  });

  // Check Supabase connection status on load
  const checkSupabaseStatus = async () => {
    const { url, anonKey } = getStoredSupabaseConfig();
    if (url && anonKey) {
      const res = await testSupabaseConnection(url, anonKey);
      setIsSupabaseConnected(res.success);
    } else {
      setIsSupabaseConnected(false);
    }
  };

  useEffect(() => {
    checkSupabaseStatus();
  }, []);

  // Initialize Realtime Sync Manager for the current room
  const syncManager = useMemo(() => {
    return new RealtimeSyncManager(
      roomPin,
      (nextState) => {
        setRoomState((prev) => ({
          ...prev,
          ...nextState,
        }));
      },
      (buzzer) => {
        sounds.playBuzzer();
      }
    );
  }, [roomPin]);

  useEffect(() => {
    return () => {
      syncManager.destroy();
    };
  }, [syncManager]);

  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    sounds.setMuted(next);
  };

  const handleStartGame = () => {
    if (roomState.submissions.length === 0) return;
    sounds.playKeywordReveal();
    syncManager.updateRoomState({
      ...roomState,
      status: 'playing',
      currentQuizIndex: 0,
      revealedKeywordCount: 1,
      activeBuzzer: null,
      lastGuessResult: null,
    });
  };

  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-900 flex flex-col font-sans selection:bg-amber-200">
      {/* Universal Top Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 px-4 py-3 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white font-black text-lg shadow-sm">
              🎯
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-800 flex items-center gap-1.5">
                스피드 키워드 경험 퀴즈
                <span className="hidden sm:inline-block text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                  Who Am I?
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                3~6개 키워드로 경험을 나누고 누구인지 맞추는 실시간 학급 게임
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Role Switcher */}
            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setRole('teacher')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  role === 'teacher'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Presentation className="w-3.5 h-3.5" />
                <span>교사용</span>
              </button>
              <button
                onClick={() => setRole('student')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  role === 'student'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>학생용</span>
              </button>
            </div>

            {/* Supabase connection badge & button */}
            <button
              onClick={() => setIsSupabaseModalOpen(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                isSupabaseConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="슈파베이스(Supabase) 데이터베이스 설정"
            >
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden md:inline">
                {isSupabaseConnected ? '슈파베이스 🟢' : '슈파베이스 설정'}
              </span>
            </button>

            {/* Mute button */}
            <button
              onClick={toggleSound}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              title={isMuted ? '음소거 해제' : '음소거'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4 text-slate-700" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 py-6">
        {role === 'teacher' ? (
          roomState.status === 'playing' || roomState.status === 'revealed' || roomState.status === 'finished' ? (
            <SpeedGameHost
              roomState={roomState}
              syncManager={syncManager}
              onBackToDashboard={() => {
                syncManager.updateRoomState({ ...roomState, status: 'waiting' });
              }}
            />
          ) : (
            <TeacherDashboard
              roomState={roomState}
              syncManager={syncManager}
              onStartGame={handleStartGame}
              onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
              isSupabaseConnected={isSupabaseConnected}
            />
          )
        ) : (
          <StudentView
            roomState={roomState}
            syncManager={syncManager}
            defaultPin={roomPin}
          />
        )}
      </main>

      {/* Supabase Configuration & SQL Guide Modal */}
      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConfigSaved={checkSupabaseStatus}
      />
    </div>
  );
}

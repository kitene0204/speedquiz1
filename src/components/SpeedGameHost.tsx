import React, { useState, useEffect } from 'react';
import { Play, Sparkles, ChevronRight, Trophy, Bell, CheckCircle2, XCircle, Volume2, RotateCcw, Award, Mic, Users, ArrowLeft } from 'lucide-react';
import { RoomState } from '../types';
import { RealtimeSyncManager } from '../lib/supabase';
import { sounds } from '../lib/sound';
import confetti from 'canvas-confetti';

interface SpeedGameHostProps {
  roomState: RoomState;
  syncManager: RealtimeSyncManager;
  onBackToDashboard: () => void;
}

export const SpeedGameHost: React.FC<SpeedGameHostProps> = ({
  roomState,
  syncManager,
  onBackToDashboard,
}) => {
  const [autoTimer, setAutoTimer] = useState(false);
  const [timeLeft, setTimeLeft] = useState(5);

  const currentSubmission = roomState.submissions[roomState.currentQuizIndex];
  const totalQuestions = roomState.submissions.length;
  const isLastQuestion = roomState.currentQuizIndex >= totalQuestions - 1;

  // Potential points calculation: fewer keywords revealed = higher score!
  const currentPoints = Math.max(20, 100 - (roomState.revealedKeywordCount - 1) * 20);

  // Auto-reveal timer effect
  useEffect(() => {
    let timer: any = null;
    if (autoTimer && roomState.status === 'playing') {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleRevealNextKeyword();
            return 5;
          }
          sounds.playTick();
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [autoTimer, roomState.status, roomState.revealedKeywordCount]);

  // Keyboard shortcut: Space to reveal next keyword
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && roomState.status === 'playing' && !roomState.activeBuzzer) {
        e.preventDefault();
        handleRevealNextKeyword();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [roomState.status, roomState.activeBuzzer, roomState.revealedKeywordCount]);

  const handleRevealNextKeyword = () => {
    if (!currentSubmission) return;
    if (roomState.revealedKeywordCount < currentSubmission.keywords.length) {
      sounds.playKeywordReveal();
      syncManager.updateRoomState({
        ...roomState,
        revealedKeywordCount: roomState.revealedKeywordCount + 1,
      });
      setTimeLeft(5);
    }
  };

  const handleJudgeCorrect = (studentName?: string) => {
    sounds.playCorrect();
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.6 },
    });

    const targetStudentName = studentName || roomState.activeBuzzer?.studentName || '';

    // Update player score
    const updatedPlayers = roomState.players.map((p) => {
      if (p.name === targetStudentName) {
        return { ...p, score: p.score + currentPoints };
      }
      return p;
    });

    syncManager.updateRoomState({
      ...roomState,
      status: 'revealed',
      players: updatedPlayers,
      activeBuzzer: null,
      lastGuessResult: {
        studentName: targetStudentName,
        guessedPerson: currentSubmission?.studentName || '',
        isCorrect: true,
      },
    });
  };

  const handleJudgeWrong = () => {
    sounds.playWrong();
    syncManager.updateRoomState({
      ...roomState,
      activeBuzzer: null,
      lastGuessResult: {
        studentName: roomState.activeBuzzer?.studentName || '',
        guessedPerson: '',
        isCorrect: false,
      },
    });
  };

  const handleNextQuestion = () => {
    if (isLastQuestion) {
      // Game Finished!
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.5 } });
      sounds.playCorrect();
      syncManager.updateRoomState({
        ...roomState,
        status: 'finished',
        activeBuzzer: null,
      });
      return;
    }

    sounds.playKeywordReveal();
    syncManager.updateRoomState({
      ...roomState,
      status: 'playing',
      currentQuizIndex: roomState.currentQuizIndex + 1,
      revealedKeywordCount: 1,
      activeBuzzer: null,
      lastGuessResult: null,
    });
    setTimeLeft(5);
  };

  const handleRestart = () => {
    syncManager.updateRoomState({
      ...roomState,
      status: 'waiting',
      currentQuizIndex: 0,
      revealedKeywordCount: 1,
      activeBuzzer: null,
      lastGuessResult: null,
    });
    onBackToDashboard();
  };

  // 1. FINAL PODIUM / GAME OVER SCREEN
  if (roomState.status === 'finished') {
    const sortedPlayers = [...roomState.players].sort((a, b) => b.score - a.score);
    const top3 = sortedPlayers.slice(0, 3);

    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6 animate-fade-in text-center">
        <div className="bg-gradient-to-b from-indigo-950 via-slate-900 to-indigo-950 rounded-3xl p-8 sm:p-12 text-white shadow-2xl border border-indigo-800/40 relative overflow-hidden">
          <div className="text-5xl mb-3">🏆</div>
          <h2 className="text-3xl sm:text-4xl font-black text-amber-300 tracking-tight">
            스피드 퀴즈 종료! 영광의 명예의 전당
          </h2>
          <p className="text-indigo-200 text-sm mt-1 mb-8">
            친구들의 특별한 경험을 가장 빠르게 맞춘 학생들입니다!
          </p>

          {/* Podium */}
          <div className="flex justify-center items-end gap-3 sm:gap-6 my-10 max-w-lg mx-auto">
            {/* 2nd place */}
            {top3[1] && (
              <div className="flex-1 flex flex-col items-center">
                <span className="text-3xl mb-1">{top3[1].avatar}</span>
                <span className="text-sm font-bold text-slate-300">{top3[1].name}</span>
                <span className="text-xs text-amber-300 font-bold mb-2">{top3[1].score}점</span>
                <div className="w-full bg-slate-700/80 rounded-t-2xl h-24 flex items-center justify-center font-black text-2xl text-slate-300 border-t-2 border-slate-400">
                  🥈 2위
                </div>
              </div>
            )}

            {/* 1st place */}
            {top3[0] && (
              <div className="flex-1 flex flex-col items-center">
                <div className="relative">
                  <span className="text-5xl mb-1">{top3[0].avatar}</span>
                  <span className="absolute -top-3 -right-2 text-2xl animate-bounce">👑</span>
                </div>
                <span className="text-base font-black text-amber-300">{top3[0].name}</span>
                <span className="text-sm text-amber-400 font-extrabold mb-2">{top3[0].score}점</span>
                <div className="w-full bg-gradient-to-t from-amber-600 to-amber-500 rounded-t-2xl h-36 flex items-center justify-center font-black text-3xl text-amber-950 shadow-lg border-t-2 border-amber-300">
                  🥇 1위
                </div>
              </div>
            )}

            {/* 3rd place */}
            {top3[2] && (
              <div className="flex-1 flex flex-col items-center">
                <span className="text-3xl mb-1">{top3[2].avatar}</span>
                <span className="text-sm font-bold text-slate-300">{top3[2].name}</span>
                <span className="text-xs text-amber-300 font-bold mb-2">{top3[2].score}점</span>
                <div className="w-full bg-amber-900/60 rounded-t-2xl h-16 flex items-center justify-center font-black text-xl text-amber-200 border-t-2 border-amber-700">
                  🥉 3위
                </div>
              </div>
            )}
          </div>

          {/* Full ranking list */}
          <div className="bg-white/5 rounded-2xl p-4 max-w-md mx-auto mb-8 border border-white/10 text-left">
            <h4 className="text-xs font-bold text-indigo-200 mb-2 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> 전체 참가자 순위표
            </h4>
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {sortedPlayers.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-400 w-5">{idx + 1}</span>
                    <span>{p.avatar}</span>
                    <span className="font-semibold">{p.name}</span>
                  </div>
                  <span className="font-bold text-amber-300">{p.score}점</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={handleRestart}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg flex items-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> 대기실로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentSubmission) {
    return (
      <div className="p-8 text-center">
        <p>문제를 불러올 수 없습니다.</p>
        <button onClick={onBackToDashboard} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl">
          대기실로 복귀
        </button>
      </div>
    );
  }

  const revealedKeywords = currentSubmission.keywords.slice(0, roomState.revealedKeywordCount);
  const totalKeywords = currentSubmission.keywords.length;
  const hasMoreKeywords = roomState.revealedKeywordCount < totalKeywords;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Top Controller Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="대시보드로 돌아가기"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
              스피드 퀴즈 스테이지
            </span>
            <h3 className="font-black text-slate-800 text-lg">
              문제 {roomState.currentQuizIndex + 1} / {totalQuestions}
            </h3>
          </div>
        </div>

        {/* Potential Points Badge */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-sm shadow-md">
          <Trophy className="w-4 h-4" />
          <span>현재 획득 가능: {currentPoints}점</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoTimer(!autoTimer)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              autoTimer
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {autoTimer ? `⏱️ 자동 공개 중 (${timeLeft}s)` : '⏱️ 자동 공개 켜기'}
          </button>

          <button
            onClick={handleRevealNextKeyword}
            disabled={!hasMoreKeywords || roomState.status === 'revealed'}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            다음 힌트 키워드 공개 (+1)
          </button>
        </div>
      </div>

      {/* Main Big Stage Box (Projector Optimized) */}
      <div className="bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 rounded-3xl p-8 sm:p-14 text-white shadow-2xl border border-indigo-900/50 text-center relative overflow-hidden min-h-[480px] flex flex-col justify-between">
        <div className="absolute inset-0 bg-radial from-indigo-500/10 via-transparent to-transparent pointer-events-none" />

        {/* Stage Header */}
        <div className="relative z-10">
          <span className="px-4 py-1.5 rounded-full bg-white/10 text-amber-300 text-xs sm:text-sm font-bold tracking-wide backdrop-blur-md">
            누구의 경험일까요? 키워드를 보고 주인공을 맞춰보세요!
          </span>
          <p className="text-slate-400 text-xs mt-2">
            힌트 {revealedKeywords.length} / {totalKeywords}개 공개됨 (스페이스바로 추가 공개 가능)
          </p>
        </div>

        {/* Active Buzzer Overlay */}
        {roomState.activeBuzzer && roomState.status === 'playing' && (
          <div className="my-6 p-6 rounded-3xl bg-red-600 text-white shadow-2xl border-4 border-amber-300 animate-bounce max-w-lg mx-auto">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Bell className="w-8 h-8 animate-spin" />
              <span className="text-xl font-black">버저가 울렸습니다!</span>
            </div>
            <h3 className="text-3xl font-black text-amber-200">
              🚨 [{roomState.activeBuzzer.studentName}] 학생!
            </h3>
            <p className="text-sm text-red-100 mt-1 mb-4">정답을 말해주세요!</p>

            <div className="flex justify-center gap-3">
              <button
                onClick={() => handleJudgeCorrect()}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" /> ⭕ 정답 인정 (+{currentPoints}점)
              </button>
              <button
                onClick={handleJudgeWrong}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                <XCircle className="w-5 h-5" /> ❌ 땡! (오답)
              </button>
            </div>
          </div>
        )}

        {/* REVEALED STAGE: DRAMATIC AUTHOR REVEAL */}
        {roomState.status === 'revealed' ? (
          <div className="my-6 p-6 sm:p-10 rounded-3xl bg-white/10 backdrop-blur-md border-2 border-emerald-400/60 max-w-2xl mx-auto animate-scale-up text-center">
            <span className="text-6xl sm:text-7xl block mb-2">{currentSubmission.avatar}</span>
            <span className="text-xs uppercase font-extrabold text-emerald-400 tracking-wider">
              🎉 경험의 주인공 공개!
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mt-1 mb-4 drop-shadow-md">
              {currentSubmission.studentName} 학생!
            </h2>

            {/* Behind story box */}
            {currentSubmission.story && (
              <div className="p-4 rounded-2xl bg-black/30 border border-white/10 text-left my-4">
                <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                  <Mic className="w-3.5 h-3.5" /> 비하인드 경험담:
                </p>
                <p className="text-sm text-slate-200 leading-relaxed italic">
                  "{currentSubmission.story}"
                </p>
              </div>
            )}

            <p className="text-xs text-indigo-200">
              주인공 학생의 짧은 소감이나 경험담을 학급 친구들과 함께 들어보세요! 🎙️
            </p>
          </div>
        ) : (
          /* PLAYING STAGE: REVEALED KEYWORDS DISPLAY */
          <div className="my-8 flex flex-wrap gap-3 sm:gap-4 justify-center items-center max-w-3xl mx-auto">
            {revealedKeywords.map((kw, idx) => (
              <div
                key={idx}
                className="px-6 sm:px-8 py-3.5 sm:py-5 rounded-3xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white font-black text-2xl sm:text-4xl shadow-2xl border-2 border-amber-300/40 animate-scale-up tracking-tight"
              >
                #{kw}
              </div>
            ))}

            {/* Unrevealed placeholders */}
            {Array.from({ length: totalKeywords - revealedKeywords.length }).map((_, i) => (
              <div
                key={`hidden_${i}`}
                className="px-6 sm:px-8 py-3.5 sm:py-5 rounded-3xl bg-white/5 border-2 border-dashed border-white/20 text-white/30 font-black text-xl sm:text-3xl"
              >
                🔒 힌트 #{revealedKeywords.length + i + 1}
              </div>
            ))}
          </div>
        )}

        {/* Stage Bottom Actions */}
        <div className="relative z-10 flex flex-wrap justify-center items-center gap-3 pt-4 border-t border-white/10">
          {roomState.status === 'playing' ? (
            <>
              <button
                onClick={() => handleJudgeCorrect()}
                className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" /> 주인공 직접 공개하기 (정답)
              </button>
            </>
          ) : (
            <button
              onClick={handleNextQuestion}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-base shadow-xl flex items-center gap-2 cursor-pointer animate-pulse"
            >
              <span>{isLastQuestion ? '최종 결과 및 시상대 보기 🏆' : '다음 문제로 넘어가기 ➡️'}</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Live Joined Student Buzzers & Scores */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            참여 학생 실시간 스코어보드
          </h4>
          <span className="text-xs text-slate-400">{roomState.players.length}명 참여 중</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
          {roomState.players.map((player) => (
            <div
              key={player.id}
              className={`p-3 rounded-2xl border text-center transition-all ${
                roomState.activeBuzzer?.studentName === player.name
                  ? 'bg-red-50 border-red-400 ring-2 ring-red-400 shadow-md'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="text-2xl mb-0.5">{player.avatar}</div>
              <p className="font-bold text-slate-800 text-xs truncate">{player.name}</p>
              <p className="text-xs font-black text-amber-600">{player.score}점</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

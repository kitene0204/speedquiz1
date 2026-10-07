import React, { useState, useEffect } from 'react';
import { Sparkles, Send, CheckCircle2, AlertCircle, Bell, Award, User, RefreshCw, Trophy, HelpCircle } from 'lucide-react';
import { RoomState, StudentSubmission } from '../types';
import { RealtimeSyncManager } from '../lib/supabase';
import { sounds } from '../lib/sound';
import confetti from 'canvas-confetti';

interface StudentViewProps {
  roomState: RoomState;
  syncManager: RealtimeSyncManager;
  defaultPin?: string;
}

const AVATARS = ['🐱', '🐶', '🦊', '🐼', '🦁', '🐯', '🐰', '🐨', '🦄', '🚀', '🌟', '🍕', '🎨', '🎸', '🏀', '🎮'];

const SUGGESTIONS = [
  '#제주도', '#눈보라', '#라면', '#비행기', '#강아지', '#버스킹', '#자전거', '#길잃음', '#100점', '#첫눈'
];

export const StudentView: React.FC<StudentViewProps> = ({ roomState, syncManager, defaultPin }) => {
  const [pin, setPin] = useState(defaultPin || roomState.pin || '');
  const [studentName, setStudentName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🐱');
  const [isJoined, setIsJoined] = useState(false);
  const [playerId] = useState(() => 'player_' + Math.random().toString(36).substring(2, 9));

  // Keyword input state
  const [currentTag, setCurrentTag] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [story, setStory] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Buzz & Guessing state
  const [guessedTargetName, setGuessedTargetName] = useState('');
  const [isGuessModalOpen, setIsGuessModalOpen] = useState(false);

  // Initialize from existing submission if matching name
  useEffect(() => {
    if (studentName && roomState.submissions) {
      const existing = roomState.submissions.find(s => s.studentName.trim() === studentName.trim());
      if (existing && !isEditing) {
        setKeywords(existing.keywords);
        setStory(existing.story || '');
        setHasSubmitted(true);
      }
    }
  }, [roomState.submissions, studentName, isEditing]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) return;
    setIsJoined(true);
    syncManager.sendJoin({
      id: playerId,
      name: studentName.trim(),
      avatar: selectedAvatar,
    });
  };

  const handleAddKeyword = () => {
    const trimmed = currentTag.trim();
    if (!trimmed) return;
    if (keywords.length >= 6) {
      alert('키워드는 최대 6개까지 입력할 수 있습니다.');
      return;
    }
    if (keywords.includes(trimmed)) {
      alert('이미 입력된 키워드입니다.');
      return;
    }
    setKeywords([...keywords, trimmed]);
    setCurrentTag('');
    sounds.playKeywordReveal();
  };

  const handleRemoveKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  const handleSubmitKeywords = (e: React.FormEvent) => {
    e.preventDefault();
    if (keywords.length < 3) {
      alert('키워드를 최소 3개 이상 입력해주세요!');
      return;
    }
    if (keywords.length > 6) {
      alert('키워드는 최대 6개까지 가능합니다.');
      return;
    }

    const submission: StudentSubmission = {
      id: `sub_${playerId}`,
      roomId: roomState.id,
      studentName: studentName.trim(),
      avatar: selectedAvatar,
      keywords,
      story: story.trim(),
      submittedAt: Date.now(),
    };

    syncManager.submitKeywords(submission);
    setHasSubmitted(true);
    setIsEditing(false);
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
    sounds.playCorrect();
  };

  const handleBuzzerClick = () => {
    if (roomState.status !== 'playing') return;
    if (roomState.activeBuzzer) return;

    sounds.playBuzzer();
    syncManager.sendBuzz(playerId, studentName);
    setIsGuessModalOpen(true);
  };

  const handleSendGuess = (chosenName: string) => {
    if (!chosenName.trim()) return;
    syncManager.sendGuess(studentName, chosenName.trim());
    setIsGuessModalOpen(false);
    setGuessedTargetName('');
  };

  // Get current player score
  const currentPlayer = roomState.players.find(p => p.name === studentName);
  const myScore = currentPlayer?.score || 0;

  // 1. Join Screen
  if (!isJoined) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 animate-fade-in">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-100">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg shadow-orange-500/20 mx-auto mb-3">
              🎯
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">스피드 퀴즈 입장</h2>
            <p className="text-sm text-slate-500 mt-1">방 PIN 번호와 내 이름을 입력해주세요</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">방 PIN 번호</label>
              <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="예: 4291"
                className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-amber-500 focus:outline-hidden font-mono font-bold text-center text-xl tracking-widest uppercase transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">내 이름 (또는 닉네임)</label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="예: 김민우"
                maxLength={10}
                className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-amber-500 focus:outline-hidden font-semibold text-center text-lg transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">아바타 선택</label>
              <div className="grid grid-cols-8 gap-2 p-2 bg-slate-50 rounded-2xl border border-slate-200">
                {AVATARS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedAvatar(emoji)}
                    className={`h-10 text-xl flex items-center justify-center rounded-xl transition-transform ${
                      selectedAvatar === emoji
                        ? 'bg-amber-400 scale-110 shadow-sm'
                        : 'hover:bg-slate-200 hover:scale-105'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-4 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-base shadow-lg shadow-orange-500/25 hover:from-amber-600 hover:to-orange-600 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-5 h-5" /> 게임 방 입장하기
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Keyword Creation Form (Before Submission or during Editing)
  if (!hasSubmitted || isEditing) {
    return (
      <div className="max-w-lg mx-auto p-4 sm:p-6 animate-fade-in">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-100">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl p-2 bg-amber-50 rounded-2xl border border-amber-100">{selectedAvatar}</span>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{studentName}의 경험 키워드</h3>
                <p className="text-xs text-slate-400">나만의 특별한 순간을 단어로 표현해보세요</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
              {keywords.length} / 6개
            </span>
          </div>

          <form onSubmit={handleSubmitKeywords} className="space-y-5">
            {/* Keyword tag input */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  경험 키워드 입력 (3개 ~ 6개 필수)
                </label>
                <span className={`text-xs font-bold ${keywords.length >= 3 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {keywords.length < 3 ? `최소 ${3 - keywords.length}개 더 필요` : '제출 준비 완료!'}
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentTag}
                  onChange={(e) => setCurrentTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddKeyword();
                    }
                  }}
                  placeholder="예: 제주도, 텐트, 멧돼지..."
                  maxLength={15}
                  disabled={keywords.length >= 6}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-hidden text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddKeyword}
                  disabled={!currentTag.trim() || keywords.length >= 6}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  추가
                </button>
              </div>

              {/* Tag Suggestions */}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
                  <HelpCircle className="w-3 h-3" /> 추천:
                </span>
                {SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => {
                      const tag = sug.replace('#', '');
                      if (keywords.length < 6 && !keywords.includes(tag)) {
                        setKeywords([...keywords, tag]);
                        sounds.playKeywordReveal();
                      }
                    }}
                    className="text-xs px-2.5 py-1 rounded-full bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-600 transition-colors"
                  >
                    {sug}
                  </button>
                ))}
              </div>

              {/* Chips list */}
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl min-h-[90px] flex flex-wrap gap-2 items-center">
                {keywords.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center w-full py-3">
                    단어를 입력하고 [추가]를 누르면 여기에 키워드 카드가 생깁니다.
                  </p>
                ) : (
                  keywords.map((kw, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm shadow-xs animate-scale-up"
                    >
                      <span>#{kw}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(idx)}
                        className="w-4 h-4 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-xs ml-1"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Behind story */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                비하인드 한 줄 이야기 <span className="text-slate-400 font-normal">(정답 공개 시 친구들에게 들려줄 내용)</span>
              </label>
              <textarea
                value={story}
                onChange={(e) => setStory(e.target.value)}
                rows={2}
                placeholder="예: 초등학교 4학년 여름방학 때 가족이랑 캠핑 갔다가 멧돼지를 만나서 텐트 속에 숨었던 적이 있어요!"
                maxLength={120}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-hidden text-sm resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={keywords.length < 3}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-base shadow-lg shadow-teal-600/25 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-5 h-5" /> 키워드 제출 완료하기
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. Waiting Room & Submitted State (Before Game starts)
  if (roomState.status === 'waiting' || roomState.status === 'submitting') {
    const totalSubmissions = roomState.submissions.length;

    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 animate-fade-in">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-100 text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4 text-3xl shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h3 className="text-2xl font-black text-slate-800">제출 완료!</h3>
          <p className="text-sm text-slate-500 mt-1">선생님이 게임을 시작할 때까지 잠시 대기해주세요.</p>

          <div className="my-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-900">내가 적은 키워드 ({keywords.length}개)</span>
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs text-amber-700 hover:text-amber-900 font-semibold underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> 수정하기
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((kw, i) => (
                <span key={i} className="text-xs font-bold px-2.5 py-1 bg-amber-200 text-amber-900 rounded-lg">
                  #{kw}
                </span>
              ))}
            </div>
            {story && (
              <p className="text-xs text-amber-800 mt-2.5 pt-2 border-t border-amber-200/60 italic">
                "{story}"
              </p>
            )}
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 mb-4">
            <p className="text-xs text-slate-500 mb-1">현재 학급 제출 현황</p>
            <p className="text-2xl font-black text-slate-800">
              <span className="text-emerald-600">{totalSubmissions}</span> 명 제출 완료
            </p>
          </div>

          <p className="text-xs text-slate-400">선생님이 게임을 시작하면 화면이 자동으로 스피드 퀴즈로 전환됩니다!</p>
        </div>
      </div>
    );
  }

  // 4. Live Speed Game Screen
  const currentSubmission = roomState.submissions[roomState.currentQuizIndex];
  const revealedKeywords = currentSubmission
    ? currentSubmission.keywords.slice(0, roomState.revealedKeywordCount)
    : [];
  const isMySubmission = currentSubmission?.studentName === studentName;
  const isBuzzerActive = !!roomState.activeBuzzer;
  const amIBuzzerHolder = roomState.activeBuzzer?.studentId === playerId;

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 animate-fade-in">
      {/* Top bar with score */}
      <div className="bg-white rounded-2xl p-4 shadow-md border border-slate-100 flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{selectedAvatar}</span>
          <div>
            <span className="text-xs font-semibold text-slate-400">참여자</span>
            <p className="font-bold text-slate-800 leading-tight">{studentName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 font-bold text-sm">
          <Trophy className="w-4 h-4 text-amber-600" />
          <span>{myScore} 점</span>
        </div>
      </div>

      {/* Main Quiz Box */}
      <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 text-center relative overflow-hidden">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-4 pb-2 border-b border-slate-100">
          <span>문제 #{roomState.currentQuizIndex + 1} / {roomState.submissions.length}</span>
          <span className="text-amber-600">
            {roomState.status === 'playing' ? '실시간 스피드 퀴즈 진행 중!' : '정답 공개!'}
          </span>
        </div>

        {/* Revealed Keywords Display */}
        <div className="min-h-[120px] flex flex-col justify-center items-center py-2">
          <p className="text-xs font-bold text-slate-500 mb-3">현재 공개된 힌트 키워드</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {revealedKeywords.map((kw, idx) => (
              <span
                key={idx}
                className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-lg shadow-md animate-scale-up"
              >
                #{kw}
              </span>
            ))}
          </div>
        </div>

        {/* Buzzer Alert Banner */}
        {isBuzzerActive && (
          <div className="my-4 p-3 rounded-2xl bg-red-500 text-white font-bold text-sm animate-pulse flex items-center justify-center gap-2">
            <Bell className="w-4 h-4" />
            <span>
              {amIBuzzerHolder
                ? '내가 가장 먼저 버저를 눌렀습니다! 정답을 입력하세요!'
                : `🚨 ${roomState.activeBuzzer?.studentName} 학생이 버저를 눌렀습니다!`}
            </span>
          </div>
        )}

        {/* Revealed Winner Banner */}
        {roomState.status === 'revealed' && currentSubmission && (
          <div className="my-4 p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 animate-scale-up">
            <div className="text-4xl mb-1">{currentSubmission.avatar}</div>
            <p className="text-xs font-bold text-emerald-700">이 경험의 주인공은?</p>
            <h4 className="text-2xl font-black text-emerald-900 mt-1">{currentSubmission.studentName}</h4>
            {currentSubmission.story && (
              <p className="text-xs text-emerald-800 mt-2 bg-white/70 p-2.5 rounded-xl italic">
                "{currentSubmission.story}"
              </p>
            )}
          </div>
        )}

        {/* Giant Speed Buzzer Button */}
        {roomState.status === 'playing' && (
          <div className="mt-6">
            {isMySubmission ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 text-xs">
                💡 이번 문제는 <strong>내가 쓴 키워드</strong>입니다! 친구들이 맞추는 모습을 지켜보세요 🤫
              </div>
            ) : (
              <button
                onClick={handleBuzzerClick}
                disabled={isBuzzerActive}
                className={`w-40 h-40 mx-auto rounded-full font-black text-xl text-white shadow-2xl flex flex-col items-center justify-center gap-1 transition-all transform active:scale-90 cursor-pointer ${
                  isBuzzerActive
                    ? 'bg-slate-300 text-slate-400 shadow-none cursor-not-allowed'
                    : 'bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 hover:scale-105 active:shadow-inner shadow-red-500/40'
                }`}
              >
                <Bell className="w-10 h-10 animate-bounce" />
                <span>정답 버저!</span>
                <span className="text-[11px] font-normal opacity-90">누구인지 알겠다면 탭!</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Guess Modal when buzzer is pressed */}
      {isGuessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 animate-scale-up">
            <h4 className="text-lg font-black text-slate-800 text-center mb-1">누구의 경험인가요?</h4>
            <p className="text-xs text-slate-500 text-center mb-4">친구의 이름을 선택하거나 직접 입력하세요</p>

            <div className="mb-4">
              <input
                type="text"
                value={guessedTargetName}
                onChange={(e) => setGuessedTargetName(e.target.value)}
                placeholder="친구 이름 입력"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 font-bold text-center text-base focus:border-amber-500 focus:outline-hidden"
              />
            </div>

            {/* Quick list of classmates */}
            <div className="max-h-40 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200 space-y-1 mb-4">
              <p className="text-[11px] font-bold text-slate-400 px-2 py-1">참여 친구 목록:</p>
              {roomState.players
                .filter(p => p.name !== studentName)
                .map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleSendGuess(p.name)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-amber-100 flex items-center justify-between text-xs font-semibold text-slate-700 transition-colors"
                  >
                    <span>{p.avatar} {p.name}</span>
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">선택</span>
                  </button>
                ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsGuessModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                onClick={() => handleSendGuess(guessedTargetName)}
                disabled={!guessedTargetName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 disabled:opacity-40"
              >
                정답 제출
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

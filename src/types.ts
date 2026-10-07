export interface StudentSubmission {
  id: string;
  roomId: string;
  studentName: string;
  avatar: string;
  keywords: string[];
  story?: string;
  submittedAt: number;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  isOnline: boolean;
}

export interface RoomState {
  id: string;
  pin: string;
  teacherName: string;
  title?: string;
  status: 'waiting' | 'submitting' | 'playing' | 'revealed' | 'finished';
  currentQuizIndex: number;
  revealedKeywordCount: number;
  timerSeconds: number;
  isTimerRunning: boolean;
  submissions: StudentSubmission[];
  players: Player[];
  activeBuzzer: {
    studentId: string;
    studentName: string;
    timestamp: number;
  } | null;
  lastGuessResult: {
    studentName: string;
    guessedPerson: string;
    isCorrect: boolean;
  } | null;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
}

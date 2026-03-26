"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  Home,
  Trophy,
  Clock,
  User,
  CheckCircle,
  Apple,
  Citrus,
  Grape,
  Cherry,
  Banana,
  Heart,
  Leaf,
  Star
} from "lucide-react";

// Google Spreadsheet 저장을 위한 Apps Script 웹 앱 URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwnJXMWpV9xXBMU71JYhAGcnToGTMLAlxVEMnHN-B2aUy-G8tYfToQV0bN_yRZauZVp/exec";

// 8 pairs of fruits
const FRUITS = [
  { id: 1, name: "사과", icon: Apple, color: "#ef4444" },
  { id: 2, name: "오렌지", icon: Citrus, color: "#f97316" },
  { id: 3, name: "포도", icon: Grape, color: "#a855f7" },
  { id: 4, name: "바나나", icon: Banana, color: "#eab308" },
  { id: 5, name: "체리", icon: Cherry, color: "#dc2626" },
  { id: 6, name: "사랑", icon: Heart, color: "#f43f5e" },
  { id: 7, name: "라임", icon: Leaf, color: "#22c55e" },
  { id: 8, name: "별", icon: Star, color: "#fbbf24" },
];

type GameStep = "NAME_INPUT" | "PLAYING" | "PAUSED" | "FINISHED";

interface Card {
  id: number;
  fruitId: number;
  isFlipped: boolean;
  isMatched: boolean;
}

export default function CardGame() {
  const [step, setStep] = useState<GameStep>("NAME_INPUT");
  const [userName, setUserName] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matches, setMatches] = useState(0);
  const [time, setTime] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [rankings, setRankings] = useState<{ name: string; finishtime: string }[]>([]);
  const [isRankingLoading, setIsRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState(false);

  const timerRef = useRef<any>(null);
  const isSavedRef = useRef(false);

  // Initialize game
  const initGame = () => {
    console.log("Initializing game for user:", userName);
    try {
      const gameFruits = [...FRUITS, ...FRUITS] // Duplicate for pairs
        .sort(() => Math.random() - 0.5)
        .map((fruit, index) => ({
          id: index,
          fruitId: fruit.id,
          isFlipped: false,
          isMatched: false,
        }));
      setCards(gameFruits);
      setMatches(0);
      setTime(0);
      setFlippedIndices([]);
      setStep("PLAYING");
      isSavedRef.current = false;
      setRankings([]);
      setRankingError(false);
      setIsRankingLoading(false);
      startTimer();
      console.log("Game started successfully");
    } catch (error) {
      console.error("Error initializing game:", error);
    }
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setTime((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleCardClick = (index: number) => {
    if (step !== "PLAYING" || !cards[index] || cards[index].isFlipped || cards[index].isMatched || flippedIndices.length === 2) {
      return;
    }

    const newCards = [...cards];
    newCards[index].isFlipped = true;
    setCards(newCards);

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      const [firstIdx, secondIdx] = newFlipped;
      if (newCards[firstIdx].fruitId === newCards[secondIdx].fruitId) {
        // Match found
        setTimeout(() => {
          setCards(prev => {
            const next = [...prev];
            next[firstIdx].isMatched = true;
            next[secondIdx].isMatched = true;
            return next;
          });
          setFlippedIndices([]);
          setMatches((prev) => {
            const newMatches = prev + 1;
            if (newMatches === FRUITS.length) {
              setStep("FINISHED");
              stopTimer();
              // 게임 종료 시 기록 저장 (현재 시간 전달)
              saveResultToSheet(time);
            }
            return newMatches;
          });
        }, 500);
      } else {
        // No match
        setTimeout(() => {
          setCards(prev => {
            const next = [...prev];
            next[firstIdx].isFlipped = false;
            next[secondIdx].isFlipped = false;
            return next;
          });
          setFlippedIndices([]);
        }, 1000);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePause = () => {
    if (step === "PLAYING") {
      setStep("PAUSED");
      stopTimer();
    } else if (step === "PAUSED") {
      setStep("PLAYING");
      startTimer();
    }
  };

  const handleRestart = () => {
    initGame();
  };

  const fetchRankings = async () => {
    if (!SCRIPT_URL) return;
    setIsRankingLoading(true);
    setRankingError(false);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8초 타임아웃

    try {
      const res = await fetch(`${SCRIPT_URL}?t=${Date.now()}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data && data.ranking) {
        // 시간(m:ss)을 초 단위로 변환하여 소요 시간이 낮은 순(오름차순)으로 정렬
        const sorted = [...data.ranking].sort((a, b) => {
          const [aMins, aSecs] = (a.finishtime || "99:59").split(":").map(Number);
          const [bMins, bSecs] = (b.finishtime || "99:59").split(":").map(Number);
          return (aMins * 60 + aSecs) - (bMins * 60 + bSecs);
        });
        // 상위 3명만 추출 (이름과 소요 시간만 표시함)
        const top3 = sorted.slice(0, 3);
        setRankings(top3);
        console.log("랭킹 로드 및 정렬 성공:", top3);
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        console.error("랭킹 로드 타임아웃 발생");
      } else {
        console.error("랭킹 로드 오류:", e);
      }
      setRankingError(true);
    } finally {
      setIsRankingLoading(false);
    }
  };

  const saveResultToSheet = async (finalTime: number) => {
    if (!SCRIPT_URL || isSavedRef.current) return;
    isSavedRef.current = true;

    const postData = {
      name: userName,
      finishtime: formatTime(finalTime)
    };

    try {
      // POST 시 mode: 'no-cors'를 사용하여 보안 정책 차단을 원천 방지합니다.
      // 저장은 성공하지만 응답 본문은 읽을 수 없으므로, 저장이 완료될 시간(1.5초) 뒤에 GET으로 조회를 시도합니다.
      await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify(postData),
      });
      console.log("기록 저장 요청 완료(no-cors)");

      // 1.5초 후 랭킹 가져오기 (Google 서버 지연 고려)
      setTimeout(fetchRankings, 1500);
    } catch (error) {
      console.error("기록 저장 오류:", error);
      fetchRankings();
    }
  };

  const handleHome = () => {
    stopTimer();
    setStep("NAME_INPUT");
    setUserName("");
  };

  useEffect(() => {
    setIsReady(true);
    return () => stopTimer();
  }, []);

  if (!isReady) return null;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4 md:p-8 bg-background overflow-hidden font-sans">
      {/* Background Ornaments */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -40, 0], y: [0, 60, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-32 -right-32 w-[30rem] h-[30rem] bg-accent/5 rounded-full blur-3xl"
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <AnimatePresence mode="wait">
        {step === "NAME_INPUT" && (
          <motion.div
            key="name-input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass p-10 rounded-[3rem] w-full max-w-md flex flex-col items-center gap-8 text-center"
          >
            <div className="w-24 h-24 bg-primary rounded-3xl flex items-center justify-center shadow-lg transform rotate-6 scale-110">
              <Trophy className="w-12 h-12 text-white" />
            </div>

            <div className="space-y-2">
              <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
                과일 짝 맞추기
              </h1>
              <p className="text-foreground/60">최고의 기록에 도전해보세요!</p>
            </div>

            <div className="w-full space-y-4">
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40 group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder="당신의 이름을 입력하세요"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full h-16 pl-12 pr-4 bg-secondary/30 border-2 border-transparent focus:border-primary/50 focus:bg-white rounded-2xl outline-none transition-all text-lg font-medium"
                />
              </div>

              <button
                onClick={initGame}
                disabled={!userName.trim()}
                className={`w-full h-16 rounded-2xl text-xl font-bold shadow-xl transition-all flex items-center justify-center gap-3 cursor-pointer ${userName.trim()
                    ? "bg-primary text-white hover:bg-primary/91 shadow-primary/20 active:scale-95"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed opacity-60"
                  }`}
              >
                <Play className={userName.trim() ? "fill-current" : ""} />
                게임 시작
              </button>
            </div>
          </motion.div>
        )}

        {(step === "PLAYING" || step === "PAUSED") && (
          <motion.div
            key="game-board"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-2xl flex flex-col gap-6"
          >
            {/* Header */}
            <div className="glass p-6 rounded-3xl flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-foreground/40 uppercase tracking-widest">Player</span>
                <span className="text-xl font-bold text-foreground">{userName}</span>
              </div>
              <div className="flex gap-4">
                <div className="bg-secondary p-3 px-5 rounded-2xl flex items-center gap-3">
                  <Clock className="w-5 h-5 text-accent" />
                  <span className="text-xl font-black font-mono tabular-nums text-foreground">{formatTime(time)}</span>
                </div>
                <div className="bg-white/50 p-3 px-5 rounded-2xl flex items-center gap-3 border border-primary/20">
                  <span className="text-xl font-black text-primary">{matches}/8</span>
                  <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
                </div>
              </div>
            </div>

            {/* Grid */}
            <div className="relative">
              <div className={`grid grid-cols-4 gap-3 md:gap-5 aspect-square bg-white/30 p-4 md:p-6 rounded-[2.5rem] border border-white/50 shadow-2xl transition-all ${step === "PAUSED" ? "blur-xl" : ""}`}>
                {cards.map((card, idx) => {
                  const fruit = FRUITS.find((f) => f.id === card.fruitId)!;
                  const Icon = fruit.icon;
                  return (
                    <div
                      key={card.id}
                      onClick={() => handleCardClick(idx)}
                      className={`card-flip relative w-full aspect-square cursor-pointer transition-transform active:scale-95 ${card.isMatched ? "opacity-60 grayscale-[0.5]" : ""}`}
                    >
                      <div className={`card-inner w-full h-full relative ${card.isFlipped || card.isMatched ? "card-flipped" : ""}`}>
                        {/* Front (Hidden) */}
                        <div className="card-front bg-white rounded-xl md:rounded-3xl shadow-lg border-2 border-primary/10 flex items-center justify-center overflow-hidden">
                          <div className="w-full h-full bg-secondary/20 flex items-center justify-center group opacity-100">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                              <div className="w-4 h-4 rounded-full bg-primary/20" />
                            </div>
                          </div>
                        </div>
                        {/* Back (Visible fruit) */}
                        <div className="card-back bg-white rounded-xl md:rounded-3xl shadow-lg border-4 border-white flex items-center justify-center">
                          <div className="text-white p-2 md:p-4 rounded-2xl">
                            <Icon size={48} color={fruit.color} strokeWidth={2.5} />
                          </div>
                        </div>
                      </div>
                      {card.isMatched && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-success text-white rounded-full p-1 shadow-lg">
                            <CheckCircle size={24} />
                          </motion.div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {step === "PAUSED" && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-white/20 backdrop-blur-sm rounded-[2.5rem]">
                  <h2 className="text-4xl font-black text-foreground/80">준비 됐나요?</h2>
                  <button
                    onClick={handlePause}
                    className="w-20 h-20 bg-primary hover:bg-primary/90 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-all cursor-pointer"
                  >
                    <Play size={40} className="fill-current" />
                  </button>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex gap-4">
              <button
                onClick={handlePause}
                className="flex-1 h-14 bg-white/80 hover:bg-white text-foreground rounded-2xl font-bold flex items-center justify-center gap-2 border border-black/5 shadow-md active:scale-95 transition-all"
              >
                {step === "PAUSED" ? <Play size={20} /> : <Pause size={20} />}
                {step === "PAUSED" ? "재개하기" : "멈춤"}
              </button>
              <button
                onClick={handleRestart}
                className="flex-1 h-14 bg-white/80 hover:bg-white text-foreground rounded-2xl font-bold flex items-center justify-center gap-2 border border-black/5 shadow-md active:scale-95 transition-all"
              >
                <RotateCcw size={20} />
                다시 시작
              </button>
              <button
                onClick={handleHome}
                className="flex-1 h-14 bg-accent/10 hover:bg-accent/20 text-accent rounded-2xl font-bold flex items-center justify-center gap-2 border border-accent/20 shadow-md active:scale-95 transition-all"
              >
                <Home size={20} />
                처음으로
              </button>
            </div>
          </motion.div>
        )}

        {step === "FINISHED" && (
          <motion.div
            key="finish-screen"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass p-8 md:p-12 rounded-[3.5rem] w-full max-w-lg flex flex-col items-center gap-6 text-center"
          >
            <div className="relative">
              <div className="w-24 h-24 md:w-32 md:h-32 bg-success rounded-full flex items-center justify-center shadow-xl shadow-success/30 scale-105">
                <Trophy size={48} className="text-white" />
              </div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-4 border-4 border-dashed border-success/30 rounded-full"
              />
            </div>

            <div className="space-y-1">
              <h2 className="text-3xl md:text-4xl font-black text-foreground">축하합니다!</h2>
              <p className="text-lg md:text-xl font-semibold text-foreground/60">{userName}님이 해내셨어요.</p>
            </div>

            <div className="w-full grid grid-cols-2 gap-4">
              <div className="bg-success/5 p-5 rounded-3xl border border-success/10 flex flex-col gap-1 items-start">
                <span className="text-[10px] font-bold text-success/60 uppercase tracking-widest">내 기록</span>
                <span className="text-2xl md:text-3xl font-black font-mono text-success tabular-nums">{formatTime(time)}</span>
              </div>
              <div className="bg-primary/5 p-5 rounded-3xl border border-primary/10 flex flex-col gap-1 items-start">
                <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">격자 크기</span>
                <span className="text-2xl md:text-3xl font-black font-mono text-primary">4 × 4</span>
              </div>
            </div>

            {/* Ranking Display Section */}
            <div className="w-full space-y-3 bg-white/40 p-5 md:p-7 rounded-[2.5rem] border border-black/5 shadow-inner">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-black text-foreground/80 flex items-center gap-2">
                  <Star size={16} className="text-primary fill-current" />
                  전체 TOP 3 랭킹
                </h3>
                {rankingError && (
                  <button onClick={fetchRankings} className="text-[10px] font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer">
                    <RotateCcw size={10} /> 다시 불러오기
                  </button>
                )}
              </div>

              <div className="space-y-2 min-h-[120px] flex flex-col justify-center">
                {isRankingLoading ? (
                  <div className="flex flex-col items-center gap-2 text-foreground/30 py-4">
                    <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">기록을 불러오는 중...</span>
                  </div>
                ) : rankings.length > 0 ? (
                  rankings.map((rank, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`flex items-center justify-between p-3 px-5 rounded-2xl bg-white/60 shadow-sm border border-black/5 ${rank.name === userName && rank.finishtime === formatTime(time) ? "ring-2 ring-success/30 bg-success/10 scale-105" : ""}`}
                    >
                      <span className="font-bold text-foreground/80 text-sm">{rank.name}</span>
                      <span className="font-mono font-bold text-primary text-sm whitespace-nowrap">{rank.finishtime}</span>
                    </motion.div>
                  ))
                ) : (
                  <div className="flex flex-col items-center gap-2 text-foreground/30 py-4">
                    <span className="text-[10px] font-bold uppercase">순위 데이터가 아직 없습니다.</span>
                    <button onClick={fetchRankings} className="px-3 py-1 bg-white border border-black/5 rounded-lg text-[10px] font-bold text-foreground/60 hover:bg-white/80 active:scale-95 transition-all cursor-pointer">
                      데이터 확인
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="w-full grid grid-cols-2 gap-4 mt-2">
              <button
                onClick={handleRestart}
                className="h-14 md:h-16 bg-primary text-white rounded-2xl text-base md:text-lg font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw size={20} />
                다시 하기
              </button>
              <button
                onClick={handleHome}
                className="h-14 md:h-16 bg-white border-2 border-black/5 text-foreground rounded-2xl text-base md:text-lg font-bold active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Home size={20} />
                처음으로
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

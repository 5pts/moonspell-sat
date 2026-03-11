
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { DataManager } from '../lib/data';

function GlossChipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" className="option-gloss-chip__svg">
      <path
        d="M5 4h10a2 2 0 0 1 2 2v13l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path d="M8 8h6M8 11h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}

export default function Quiz({ mode, timeAttack }) {
  const navigate = useNavigate();
  const location = useLocation();
  // mode: 'LOCAL' or 'ERROR'
  const [allQuestions, setAllQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sections, setSections] = useState([]);
  const [selectedNavItem, setSelectedNavItem] = useState('ALL');
  const [isWalkthrough, setIsWalkthrough] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [selectedOption, setSelectedOption] = useState(null);
  const [shakingOption, setShakingOption] = useState(null);
  const [openOptionGloss, setOpenOptionGloss] = useState(null);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);

  // Word popover state
  const [wordPopover, setWordPopover] = useState(null); // { word, x, y }
  const [, setWordBookmarksVersion] = useState(0);
  const [, setOptionBookmarksVersion] = useState(0);
  const [wordLookup, setWordLookup] = useState(null);
  const [wordLookupStatus, setWordLookupStatus] = useState('idle');
  const popoverRef = useRef(null);
  
  // Load questions on mount
  useEffect(() => {
    let qs = DataManager.getAllQuestions();
    if (mode === 'ERROR') {
      const errorIds = DataManager.getMistakes();
      qs = qs.filter(q => errorIds.includes(q.id));
    }
    setAllQuestions(qs);
    setFilteredQuestions(qs);
    setSections(DataManager.getSections());
  }, [mode]);

  // Generate Navigation Items
  const navItems = useMemo(() => {
      const items = [{ id: 'ALL', label: 'ALL SECTIONS', filter: () => true }];
      
      sections.forEach(sec => {
          if (sec.count > 20) {
              // Split into chunks of 20
              const chunkCount = Math.ceil(sec.count / 20);
              for (let i = 0; i < chunkCount; i++) {
                  const start = i * 20 + 1;
                  const end = Math.min((i + 1) * 20, sec.count);
                  
                  items.push({
                      id: `${sec.code}-${i}`,
                      label: `${sec.displayName.split('(')[0]} (${start}-${end})`,
                      sectionCode: sec.code,
                      range: [start, end] // 1-based index within the section
                  });
              }
          } else {
              items.push({
                  id: sec.code,
                  label: sec.displayName,
                  sectionCode: sec.code,
                  range: null
              });
          }
      });
      return items;
  }, [sections]);

  // Filter effect
  useEffect(() => {
    let filtered = allQuestions;

    if (selectedNavItem !== 'ALL') {
      const navItem = navItems.find(n => n.id === selectedNavItem);
      if (navItem) {
          // First filter by section
          const sectionQs = allQuestions.filter(q => q.sectionCode === navItem.sectionCode);
          
          if (navItem.range) {
              // Slice the array
              const [start, end] = navItem.range;
              // start is 1-based
              filtered = sectionQs.slice(start - 1, end);
          } else {
              filtered = sectionQs;
          }
      }
    }
    
    setFilteredQuestions(filtered);
    setCurrentIndex(0); // Reset to first result
  }, [selectedNavItem, allQuestions, navItems]);

  const currentQ = filteredQuestions[currentIndex];
  const requestedQuestionId = new URLSearchParams(location.search).get('question');
  const isBookmarked = currentQ ? DataManager.getBookmarks().includes(currentQ.id) : false;
  const isMistake = currentQ ? DataManager.getMistakes().includes(currentQ.id) : false;
  const analysis = currentQ?.analysis;
  const currentOptionLabels = useMemo(() => ['A', 'B', 'C', 'D', 'E'], []);
  
  // Logic for "Answered" state
  const isAnswered = selectedOption !== null;
  const showAnswerPanel = isWalkthrough || isAnswered;

  // Timer logic
  useEffect(() => {
    if (!isWalkthrough && timeAttack && !isAnswered && timeLeft > 0 && currentQ) {
      const timerId = setTimeout(() => setTimeLeft(t => t - 1), 1000);
      return () => clearTimeout(timerId);
    } else if (!isWalkthrough && timeAttack && !isAnswered && timeLeft === 0 && currentQ) {
      handleOptionClick(-1);
    }
  }, [isWalkthrough, timeAttack, isAnswered, timeLeft, currentQ]);

  // Reset state on question change
  useEffect(() => {
    setSelectedOption(null);
    setTimeLeft(15);
    setOpenOptionGloss(null);
  }, [currentIndex, currentQ]);

  useEffect(() => {
    if (!requestedQuestionId || !filteredQuestions.length) return;
    const targetIndex = filteredQuestions.findIndex((question) => question.id === requestedQuestionId);
    if (targetIndex !== -1) {
      setCurrentIndex(targetIndex);
    }
  }, [requestedQuestionId, filteredQuestions]);

  const handleOptionClick = (index) => {
    if (isAnswered || isWalkthrough) return;
    const isCorrectAnswer = index === currentQ.answer;
    
    if (!isCorrectAnswer && index !== -1) {
      setShakingOption(index);
      setTimeout(() => setShakingOption(null), 500);
    }
    
    setSelectedOption(index);
    DataManager.recordAttempt({
      questionId: currentQ.id,
      sectionCode: currentQ.sectionCode,
      correct: isCorrectAnswer,
      selectedIndex: index,
      answerIndex: currentQ.answer,
      mode,
    });

    if (isCorrectAnswer) {
      setStreak(prev => prev + 1);
    } else {
      setStreak(0);
      if (index !== -1) {
         DataManager.addMistake(currentQ.id);
      }
    }
  };

  const handleNext = () => {
    if (currentIndex < filteredQuestions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      navigate('/data-board');
    }
  };

  const toggleBookmark = () => {
    DataManager.toggleBookmark(currentQ.id);
    setFilteredQuestions([...filteredQuestions]);
  };

  const toggleOptionGloss = useCallback((optionIndex, event) => {
    event.stopPropagation();
    setOpenOptionGloss((current) => (current === optionIndex ? null : optionIndex));
  }, []);

  const toggleOptionBookmark = useCallback((optionIndex, event) => {
    event.stopPropagation();
    if (!currentQ) return;
    DataManager.toggleOptionBookmark({ questionId: currentQ.id, optionIndex });
    setOptionBookmarksVersion((value) => value + 1);
  }, [currentQ]);

  const handleOptionCardClick = useCallback((optionIndex, event) => {
    if (isWalkthrough || isAnswered) return;

    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('[data-option-action="true"]')
    ) {
      return;
    }

    handleOptionClick(optionIndex);
  }, [isAnswered, isWalkthrough, currentQ, selectedOption]);

  // Word popover handlers
  const handleWordClick = useCallback((e, word) => {
    e.stopPropagation();
    const clean = word.toLowerCase().replace(/[^a-z'-]/g, '');
    if (!clean || clean.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setWordPopover({ word: clean, x: rect.left + rect.width / 2, y: rect.bottom + 8 });
  }, []);

  const toggleWordBookmark = useCallback((word) => {
    DataManager.toggleWordBookmark(word);
    setWordBookmarksVersion(v => v + 1);
  }, []);

  // Close popover on outside click or ESC
  useEffect(() => {
    if (!wordPopover) return;
    const handleClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setWordPopover(null);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setWordPopover(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [wordPopover]);

  useEffect(() => {
    let active = true;

    if (!wordPopover?.word) {
      setWordLookup(null);
      setWordLookupStatus('idle');
      return undefined;
    }

    const cached = DataManager.getCachedWordLookup(wordPopover.word);
    if (cached) {
      setWordLookup(cached);
      setWordLookupStatus('ready');
    } else {
      setWordLookup(null);
      setWordLookupStatus('loading');
    }

    DataManager.fetchWordLookup(wordPopover.word).then((result) => {
      if (!active) return;
      setWordLookup(result);
      setWordLookupStatus(result ? 'ready' : 'empty');
    });

    return () => {
      active = false;
    };
  }, [wordPopover]);

  // Close popover on question change
  useEffect(() => {
    setWordPopover(null);
    setWordLookup(null);
    setWordLookupStatus('idle');
  }, [currentIndex]);

  // Render a clickable word span
  const renderClickableWord = (word, key) => (
    <span
      key={key}
      onClick={(e) => handleWordClick(e, word)}
      className="inline-block px-0.5 rounded-sm cursor-pointer hover:bg-[var(--accent-blue)] hover:text-[var(--text-on-color)] transition-colors duration-150"
    >
      {word}
    </span>
  );

  const renderWordAwareText = useCallback((text, prefix, interactive = true) => (
    String(text || '').split(/([\w']+)/g).map((segment, index) => {
      if (!segment) return null;
      if (/^[\w']+$/.test(segment)) {
        return interactive
          ? renderClickableWord(segment, `${prefix}-${index}`)
          : <span key={`${prefix}-${index}`}>{segment}</span>;
      }
      return <span key={`${prefix}-${index}`}>{segment}</span>;
    })
  ), [renderClickableWord]);

  const splitOptionIntoBlankParts = useCallback((optionText) => {
    if (!optionText) return [''];
    const segments = String(optionText)
      .split(/\s*\.\.\s*/)
      .map((segment) => segment.trim())
      .filter(Boolean);
    return segments.length > 0 ? segments : [String(optionText)];
  }, []);

  const renderSentence = useCallback((optionIndex = null, { interactiveWords = true, keyPrefix = 'stem' } = {}) => {
    const parts = currentQ.sentence.split(/(_+|[\w']+)/g);
    const activeOptionText =
      Number.isInteger(optionIndex) && optionIndex >= 0 && currentQ.options[optionIndex]
        ? currentQ.options[optionIndex]
        : '';
    const blankParts = splitOptionIntoBlankParts(activeOptionText);
    let blankIndex = 0;

    return parts.map((part, i) => {
      if (!part) return null;

      if (/^_+$/.test(part)) {
        const content = blankParts[blankIndex] || blankParts[0] || '';
        const isFilled = Boolean(content);
        blankIndex += 1;

        return (
          <span
            key={`${keyPrefix}-blank-${i}`}
            className={`inline-flex items-end justify-center min-w-[140px] px-2 mx-2 border-b-4 transition-all duration-300 ${
              isFilled
                ? 'theme-border-blue theme-text-blue font-bold text-2xl pb-[1px] align-baseline'
                : 'h-10 theme-border translate-y-1'
            }`}
          >
            {content}
          </span>
        );
      }

      if (/^[\w']+$/.test(part)) {
        return interactiveWords
          ? renderClickableWord(part, `${keyPrefix}-word-${i}`)
          : <span key={`${keyPrefix}-word-${i}`}>{part}</span>;
      }

      let displayPart = part;
      if (displayPart.includes('-')) {
        displayPart = displayPart.replace(/ - /g, ' — ');
        displayPart = displayPart.replace(/ -/g, ' —');
        displayPart = displayPart.replace(/- /g, '— ');
        if (displayPart.trim() === '-') displayPart = displayPart.replace('-', '—');
        displayPart = displayPart.replace(/--/g, '—');
      }

      if (displayPart.includes('—')) {
        return <span key={`${keyPrefix}-dash-${i}`} className="font-medium mx-1 text-xl inline-block">{displayPart}</span>;
      }

      return <span key={`${keyPrefix}-text-${i}`}>{displayPart}</span>;
    });
  }, [currentQ, renderClickableWord, splitOptionIntoBlankParts]);

  const displaySentenceOptionIndex =
    currentQ && showAnswerPanel && currentQ.answer !== -1
      ? currentQ.answer
      : (selectedOption !== null && selectedOption >= 0 ? selectedOption : null);
  const nextButtonLabel = currentIndex < filteredQuestions.length - 1 ? 'NEXT ->' : 'BOARD ->';
  const currentAnswerIndex = currentQ?.answer ?? -1;
  const isWrongState =
    !isWalkthrough &&
    selectedOption !== null &&
    selectedOption !== -1 &&
    currentAnswerIndex !== -1 &&
    selectedOption !== currentAnswerIndex;
  const isTimeoutState = selectedOption === -1 || currentAnswerIndex === -1;
  const statusToneClass = isTimeoutState
    ? 'theme-bg-orange'
    : (selectedOption === currentAnswerIndex || isWalkthrough ? 'theme-bg-green' : 'theme-bg-red');
  const statusText = isWalkthrough
    ? 'WALKTHROUGH'
    : (selectedOption === -1 ? 'TIME OUT' : (currentAnswerIndex === -1 ? 'NO KEY' : (selectedOption === currentAnswerIndex ? 'CORRECT' : 'WRONG')));

  if (!currentQ) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[50vh] relative z-50 bg-white">
         <div className="font-pixel-title text-2xl theme-text-red">NO QUESTIONS FOUND</div>
         <button className="text-black bg-yellow-200 p-2 m-2 whitespace-pre text-left">
            DEBUG: AllQ:{allQuestions.length} FilteredQ:{filteredQuestions.length} Mode:{mode}
            {'\n'}
            DataInfo: {JSON.stringify(DataManager.getDebugInfo ? DataManager.getDebugInfo() : 'NA', null, 2)}
         </button>
         <Link to="/" className="mt-4 underline">RETURN</Link>
      </div>
    );
  }

  return (
    <div className="w-full flex min-h-screen bg-transparent relative">
      {/* Sidebar Toggle Button */}
      <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`fixed top-4 left-4 z-40 p-1 md:p-2 theme-bg-card border-2 md:border-4 theme-border brutal-shadow transition-all duration-300 ${isSidebarOpen ? 'left-[17rem]' : 'left-4'}`}
          title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
      >
          <span className="font-pixel-title text-xl">{isSidebarOpen ? '«' : '☰'}</span>
      </button>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 transform transition-all duration-300 ease-in-out z-30 lg:relative lg:translate-x-0 bg-[var(--bg-card)] border-r-2 md:border-r-4 theme-border h-screen overflow-y-auto flex flex-col brutal-shadow-lg ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:w-0 lg:translate-x-0 lg:overflow-hidden'}`}>
        <div className="p-2 md:p-4 border-b-2 md:border-b-4 theme-border theme-bg-orange sticky top-0 z-10">
           <h2 className="font-pixel-title text-lg md:text-xl theme-text-on-orange whitespace-nowrap overflow-hidden">SECTIONS</h2>
        </div>
        <div className="flex-1 p-2 space-y-2 min-w-[16rem]">
            {navItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => { setSelectedNavItem(item.id); if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
                    className={`w-full text-left px-3 py-2 font-brutal-body text-sm font-bold border-2 theme-border transition-all whitespace-nowrap overflow-hidden text-ellipsis ${selectedNavItem === item.id ? 'theme-bg-blue theme-text-on-color translate-x-1' : 'theme-bg-card hover:theme-bg-blue-light'}`}
                >
                    {item.label}
                </button>
            ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center pb-20 z-10 animate-fade-in-up overflow-x-hidden">
      {/* Header Controls */}
      <div className="mt-4 md:mt-8 mb-4 md:mb-6 text-center w-full max-w-5xl relative flex flex-col items-center gap-4">
        <h1 className="font-pixel-title text-2xl md:text-5xl theme-text-blue uppercase mb-2 pixel-text-outline leading-tight">Moonspell</h1>
        
        <div className="flex flex-wrap justify-center items-center gap-2 md:gap-3 w-full">
          <button
            onClick={() => navigate('/')}
            className="theme-bg-card theme-text-primary border-2 md:border-4 theme-border brutal-shadow brutal-btn px-3 md:px-4 py-1.5 font-brutal-title text-sm md:text-base uppercase shrink-0"
          >
            MENU
          </button>

          <div className="theme-bg-card border-2 md:border-4 theme-border theme-text-primary px-2 md:px-4 py-1 font-brutal-body font-bold text-base md:text-xl uppercase brutal-shadow">
            {mode === 'ERROR' ? 'ERROR PROTOCOL' : 'LOCAL PROTOCOL'}
          </div>
          
          <div className="flex-1 max-w-md mx-2 md:mx-4 flex gap-2">
              <div className="lg:hidden w-full">
                <select 
                    value={selectedNavItem} 
                    onChange={(e) => setSelectedNavItem(e.target.value)}
                    className="w-full border-2 md:border-4 theme-border p-1 md:p-2 font-brutal-body uppercase brutal-input brutal-shadow text-sm md:text-base"
                >
                    {navItems.map(item => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                </select>
              </div>
          </div>

          <div className="flex border-2 md:border-4 theme-border brutal-shadow theme-bg-card overflow-hidden">
              <button 
                  onClick={() => setIsWalkthrough(false)}
                  className={`px-3 md:px-4 py-1.5 font-brutal-title text-base md:text-xl uppercase transition-colors duration-200 flex items-center gap-2 ${!isWalkthrough ? 'theme-bg-blue theme-text-on-color' : 'theme-bg-card theme-text-primary hover:bg-gray-100'}`}
              >
                  <span className={!isWalkthrough ? 'animate-pulse' : 'opacity-50'}>📝</span> 
                  <span className={!isWalkthrough ? 'underline decoration-2 underline-offset-4' : ''}>PRACTICE</span>
              </button>
              <div className="w-0.5 md:w-1 theme-bg-primary self-stretch"></div>
              <button 
                  onClick={() => setIsWalkthrough(true)}
                  className={`px-3 md:px-4 py-1.5 font-brutal-title text-base md:text-xl uppercase transition-colors duration-200 flex items-center gap-2 ${isWalkthrough ? 'theme-bg-orange theme-text-on-orange' : 'theme-bg-card theme-text-primary hover:bg-gray-100'}`}
              >
                  <span className={isWalkthrough ? 'animate-pulse' : 'opacity-50'}>🔍</span> 
                  <span className={isWalkthrough ? 'underline decoration-2 underline-offset-4' : ''}>WALKTHROUGH</span>
              </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-5xl mb-4 md:mb-6 flex items-stretch space-x-2 md:space-x-3">
        <div className="theme-bg-inverse theme-text-inverse font-brutal-title text-base md:text-xl px-2 md:px-4 py-2 border-2 md:border-4 theme-border flex items-center gap-2 min-w-fit">
            <span>{currentQ.id}</span>
            <span className="text-yellow-400 text-lg" title={`Difficulty: ${currentQ.difficulty || 1}/3`}>
                {'★'.repeat(currentQ.difficulty || 1)}
                <span className="text-gray-600">{'★'.repeat(3 - (currentQ.difficulty || 1))}</span>
            </span>
        </div>
        <div className="flex-1 theme-bg-card border-2 md:border-4 theme-border flex brutal-shadow">
          <div className="theme-bg-blue h-full transition-all duration-300" style={{ width: `${((currentIndex + 1) / filteredQuestions.length) * 100}%` }}></div>
        </div>
        <div className="theme-bg-card border-2 md:border-4 theme-border px-3 py-2 font-pixel-eng brutal-shadow">
            {currentIndex + 1}/{filteredQuestions.length}
        </div>
      </div>

      {/* Timer */}
      {!isWalkthrough && timeAttack && (
        <div className={`w-full max-w-5xl mb-6 relative ${timeLeft <= 5 && !isAnswered ? 'urgent-shake' : ''}`}>
          <div className={`absolute -top-3 left-4 px-2 py-0.5 font-pixel-eng text-sm z-10 border-2 theme-border ${timeLeft <= 5 && !isAnswered ? 'theme-bg-red theme-text-on-color' : 'theme-bg-inverse theme-text-inverse'}`}>
            TIME_REMAINING: {timeLeft}s
          </div>
          <div className="w-full h-4 border-2 md:border-4 theme-border theme-bg-card overflow-hidden brutal-shadow">
            <div 
              className={`h-full transition-all duration-1000 ease-linear ${timeLeft <= 5 ? 'theme-bg-red' : 'theme-bg-orange'}`} 
              style={{ width: `${(timeLeft / 15) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      <div className="w-full max-w-5xl flex flex-col relative px-4">
        {/* Question Card */}
        <div className="theme-bg-card border-2 md:border-4 theme-border brutal-shadow-lg p-4 md:p-8 mb-4 md:mb-8 relative stripe-bg">
          <div className="absolute -top-4 md:-top-5 -left-2 md:-left-4 theme-bg-orange border-2 md:border-4 theme-border px-2 md:px-3 py-1 font-brutal-title text-base md:text-xl rotate-[-3deg] brutal-shadow z-10">EXAM PAPER</div>
          
          <div className="absolute -top-6 right-2 sm:-top-5 sm:-right-4 flex gap-2 z-20">
              <button 
                onClick={toggleBookmark}
                title="Bookmark"
                className={`px-3 py-2 border-2 md:border-4 theme-border font-brutal-title text-lg brutal-shadow brutal-btn transition-all ${isBookmarked ? 'theme-bg-orange theme-text-on-orange rotate-[5deg]' : 'theme-bg-card theme-text-primary rotate-[-2deg]'}`}
              >
                {isBookmarked ? '★ SAVED' : '☆ SAVE'}
              </button>
          </div>

          <div className="font-serif-academic text-xl md:text-3xl lg:text-4xl leading-relaxed font-bold theme-text-primary mt-6 theme-bg-card p-4 md:p-6 border-2 md:border-4 theme-border w-full">
            {renderSentence(displaySentenceOptionIndex, { keyPrefix: `question-${currentQ.id}` })}
          </div>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-8 items-start">
          {currentQ.options.map((opt, i) => {
            let btnClass = "option-btn";
            let borderClass = "theme-border";

            if (showAnswerPanel) {
              if (i === currentQ.answer) {
                btnClass = "theme-bg-green theme-text-on-color";
                borderClass = "theme-border-green";
              }
              else if (i === selectedOption) {
                btnClass = "theme-bg-red theme-text-on-color";
                borderClass = "theme-border-red";
              }
              else {
                btnClass = "theme-bg-panel theme-text-muted opacity-50";
              }
            }

            if (i === shakingOption) {
              btnClass += " animate-shake";
            }

            const wordsClickable = showAnswerPanel;
            const showGloss = openOptionGloss === i;

            return (
              <div
                key={i}
                className={`p-3 md:p-4 border-2 md:border-4 ${borderClass} brutal-shadow brutal-btn relative ${btnClass} text-left group self-start ${!wordsClickable ? 'cursor-pointer' : ''}`}
                onClick={(event) => { if (!wordsClickable) handleOptionCardClick(i, event); }}
              >
                <span className="absolute -top-3 -left-3 theme-bg-inverse theme-text-inverse px-2 py-0.5 border-2 theme-border text-xs font-pixel-eng hidden md:block">[{currentOptionLabels[i]}]</span>
                <div className="flex items-start gap-3 justify-between">
                  <div className="flex items-start min-w-0 flex-1">
                    <span className="option-label px-2 md:px-3 py-1 mr-2 md:mr-4 border-2 theme-border font-brutal-title text-lg md:text-2xl uppercase shrink-0 transition-colors duration-400">{currentOptionLabels[i]}</span>
                    <span className="font-brutal-body font-bold text-base md:text-2xl break-words min-w-0">
                      {wordsClickable
                        ? renderWordAwareText(opt, `option-${currentQ.id}-${i}`)
                        : opt
                      }
                    </span>
                  </div>
                  <button
                    type="button"
                    data-option-action="true"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => toggleOptionGloss(i, event)}
                    className={`option-gloss-chip shrink-0 ${showGloss ? 'is-open' : ''}`}
                    title="查看这个选项的中文"
                  >
                    <span className="option-gloss-chip__icon">
                      <GlossChipIcon />
                    </span>
                    <span className="option-gloss-chip__label">CN</span>
                  </button>
                </div>

                {showGloss ? (
                  <div
                    className="option-gloss-panel animate-fade-in-up"
                    data-option-action="true"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="option-gloss-panel__eyebrow">OPTION GLOSS</div>
                    <div className="option-gloss-panel__body">
                      {currentQ.optionDetails?.[i]?.translation || '暂时没有这条选项的中文。'}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Answer Panel */}
        {showAnswerPanel && (
          <div className="animate-fade-in-up space-y-4">
            <div className="theme-bg-card border-2 md:border-4 theme-border brutal-shadow-lg p-4 md:p-6 stripe-bg overflow-hidden">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 flex-wrap">
                    {isWrongState ? (
                      <div className={`border-2 md:border-4 theme-border px-3 md:px-4 py-1 md:py-2 font-pixel-title text-sm md:text-lg pixel-text-outline-sm rotate-[5deg] brutal-shadow theme-text-on-color shrink-0 ${statusToneClass}`}>
                        WRONG!
                      </div>
                    ) : (
                      <div className={`px-2.5 md:px-3 py-1 md:py-1.5 border-2 md:border-4 theme-border font-pixel-eng text-xs md:text-sm uppercase brutal-shadow rotate-[2deg] theme-text-on-color shrink-0 ${statusToneClass}`}>
                        {statusText}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleNext}
                    className="w-full sm:w-auto px-3 md:px-4 py-2 theme-bg-inverse theme-text-inverse font-pixel-eng text-sm md:text-lg uppercase border-2 md:border-4 theme-border brutal-shadow brutal-btn shrink-0 sm:ml-auto"
                  >
                    {nextButtonLabel}
                  </button>
                </div>

                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="theme-bg-blue theme-text-on-color px-3 py-1 border-2 theme-border-blue font-brutal-title text-xs md:text-sm uppercase shrink-0">答案 Answer</span>
                    <div className="font-brutal-title text-2xl md:text-4xl theme-text-blue leading-tight">
                      {analysis?.answerLetter}. {renderWordAwareText(analysis?.answerText || currentQ.answerText || '', `answer-${currentQ.id}`)}
                    </div>
                    <div className="font-brutal-body text-base md:text-lg theme-text-muted">
                      {analysis?.answerTranslation}
                    </div>
                  </div>
                </div>

                {!isWalkthrough && selectedOption !== null && selectedOption >= 0 ? (
                  <div className={`border-2 md:border-4 brutal-shadow p-3 md:p-4 ${selectedOption === currentQ.answer ? 'theme-bg-green theme-text-on-color theme-border-green' : 'theme-bg-red theme-text-on-color theme-border-red'}`}>
                    <div className="font-pixel-eng text-xs md:text-sm opacity-80 mb-1">YOUR CHOICE</div>
                    <div className="font-brutal-title text-lg md:text-2xl">
                      {currentOptionLabels[selectedOption]}. {renderWordAwareText(currentQ.options[selectedOption], `selected-${currentQ.id}`)}
                    </div>
                    <div className="font-brutal-body text-sm md:text-base opacity-90 mt-1">
                      {currentQ.optionDetails?.[selectedOption]?.translation}
                    </div>
                  </div>
                ) : null}

                <div className="theme-bg-blue-light border-2 md:border-4 theme-border brutal-shadow p-4 md:p-5">
                  <div className="mb-2">
                    <span className="theme-bg-blue theme-text-on-color px-2 py-0.5 border-2 theme-border-blue font-brutal-title text-xs md:text-sm uppercase">题解 Analysis</span>
                  </div>
                  <div className="font-brutal-body font-bold text-base md:text-lg theme-text-primary leading-relaxed whitespace-pre-line">
                    {analysis?.concise || analysis?.reasoning || currentQ.explanation}
                  </div>
                </div>

                {currentQ.translation ? (
                  <div className="theme-bg-panel border-2 theme-border brutal-shadow p-3 md:p-4">
                    <div className="font-pixel-eng text-xs opacity-70 mb-1">译文</div>
                    <div className="font-brutal-body text-sm md:text-base leading-relaxed theme-text-primary">{currentQ.translation}</div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="theme-bg-card border-2 md:border-4 theme-border brutal-shadow-lg p-4 md:p-5">
              <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
                <span className="theme-bg-inverse theme-text-inverse px-2 py-0.5 border-2 theme-border font-brutal-title text-xs uppercase">选项逐个看 Option Review</span>
                <span className="font-pixel-eng text-xs theme-text-muted">每个选项都有中文和判断理由</span>
              </div>

              <div className="space-y-3">
                {(analysis?.optionReviews || []).map((review, optionIndex) => {
                  const isChosenOption = optionIndex === selectedOption;
                  const isOptionSaved = DataManager.isOptionBookmarked(currentQ.id, optionIndex);
                  const panelClass = review.isCorrect
                    ? 'theme-bg-green theme-text-on-color theme-border-green'
                    : isChosenOption && !isWalkthrough
                      ? 'theme-bg-red theme-text-on-color theme-border-red'
                      : 'theme-bg-panel theme-text-primary';

                  return (
                    <div key={`review-${review.label}`} className={`border-2 md:border-4 brutal-shadow p-3 md:p-4 ${panelClass}`}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="space-y-2">
                          <div className="font-brutal-title text-lg md:text-2xl">
                            {review.label}. {renderWordAwareText(review.text, `review-${currentQ.id}-${review.label}`)}
                          </div>
                          <div className="font-brutal-body text-sm md:text-base opacity-90">
                            中文：{review.translation}
                          </div>
                          <div className="font-brutal-body text-sm md:text-base leading-relaxed">
                            {review.reason}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap shrink-0">
                          {review.isCorrect ? <span className="px-2 py-1 border-2 theme-border theme-bg-card font-pixel-eng text-xs theme-text-blue">CORRECT</span> : null}
                          {isChosenOption && !isWalkthrough ? <span className="px-2 py-1 border-2 theme-border theme-bg-card font-pixel-eng text-xs theme-text-red">YOUR PICK</span> : null}
                          <button
                            type="button"
                            onClick={(event) => toggleOptionBookmark(optionIndex, event)}
                            className={`option-save-chip shrink-0 ${isOptionSaved ? 'is-saved' : ''}`}
                            title={isOptionSaved ? '取消收藏这个选项' : '收藏这个选项'}
                          >
                            <span className="option-save-chip__icon">{isOptionSaved ? '★' : '☆'}</span>
                            <span className="option-save-chip__label">SAVE</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
        
        <div className="hidden md:block text-center mt-8 pb-4 text-xs font-pixel-eng theme-text-muted opacity-70">
           KEYBOARD SHORTCUTS: [1-5] SELECT ANSWER • [ENTER] CONTINUE • CLICK ANY WORD TO LOOK UP
        </div>
      </div>

      {/* Word Popover */}
      {wordPopover && (() => {
        const wordData = DataManager.getWord(wordPopover.word);
        const isWordSaved = DataManager.getWordBookmarks().includes(wordPopover.word);
        const popW = 320;
        const popH = 280;
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1000;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
        let left = Math.min(Math.max(wordPopover.x - popW / 2, 8), vw - popW - 8);
        let top = wordPopover.y;
        if (top + popH > vh - 8) top = wordPopover.y - popH - 50;

        return (
          <div
            ref={popoverRef}
            className="fixed z-[200] theme-bg-card border-4 theme-border brutal-shadow-lg animate-fade-in-up"
            style={{ left, top, width: popW }}
          >
            <div className="flex items-center justify-between p-3 border-b-4 theme-border theme-bg-inverse theme-text-inverse">
              <span className="font-brutal-title text-lg uppercase truncate">{wordPopover.word}</span>
              <button onClick={() => setWordPopover(null)} className="text-xl hover:text-red-400 ml-2 shrink-0">✕</button>
            </div>

            <div className="p-4 space-y-3">
              {wordLookupStatus === 'loading' ? (
                <div className="font-pixel-eng text-xs theme-text-orange">
                  LOADING MEANING...
                </div>
              ) : null}

              {wordLookup?.phonetic ? (
                <div className="font-brutal-title text-sm theme-text-blue">
                  {wordLookup.phonetic}
                </div>
              ) : null}

              {wordLookup?.shortDefs?.length ? (
                <div>
                  <div className="font-pixel-eng text-xs opacity-60 mb-1">DEFINITION</div>
                  <ul className="space-y-2">
                    {wordLookup.shortDefs.slice(0, 3).map((definition, index) => (
                      <li key={`def-${index}`} className="font-brutal-body text-sm leading-relaxed theme-text-primary">
                        {index + 1}. {definition}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Related questions */}
              {wordData?.relatedQuestionIds?.length > 0 && (
                <div className="font-pixel-eng text-xs theme-text-muted">
                  APPEARS IN: {wordData.relatedQuestionIds.slice(0, 5).join(', ')}
                </div>
              )}

              {/* Derivatives */}
              {wordData?.derivatives?.length > 0 && (
                <div>
                  <div className="font-pixel-eng text-xs opacity-60 mb-1">DERIVATIVES</div>
                  <div className="font-brutal-body text-xs theme-text-muted">{wordData.derivatives.slice(0, 4).join(', ')}</div>
                </div>
              )}

              {!wordData && !wordLookup && wordLookupStatus === 'empty' && (
                <div className="font-pixel-eng text-sm theme-text-muted">
                  Not in word bank yet
                </div>
              )}

              {/* Save to wordbook */}
              <button
                onClick={() => toggleWordBookmark(wordPopover.word)}
                className={`w-full py-2 border-2 theme-border font-brutal-title text-sm uppercase brutal-btn transition-colors ${isWordSaved ? 'theme-bg-orange theme-text-on-orange' : 'theme-bg-card theme-text-primary'}`}
              >
                {isWordSaved ? '★ IN WORDBOOK' : '☆ SAVE TO WORDBOOK'}
              </button>
              {isWordSaved && (
                <div className="font-pixel-eng text-xs theme-text-muted text-center">
                  Saved. Open Wordbook for mnemonic hooks, dictionary links, planning, and Flashcards mode.
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  </div>
  );
}

/** Definicje rund oraz konfiguracje dwóch pasiek. */
(function (root) {
  'use strict';

  const baseRounds = [
    {
      id: 'bees', title: 'Zbieranie pyłku',
      instruction: 'Najedź na pszczoły i uszczypnij, żeby zebrać pyłek.',
      type: 'collect', points: 100,
      easy: { duration: 34, target: 8 },
      hard: { duration: 26, target: 14 }
    },
    {
      id: 'frame', title: 'Wyciąganie ramki',
      instruction: 'Uszczypnij ramkę i przeciągnij ją W GÓRĘ. Szarpnięcia zabierają punkty.',
      type: 'drag', points: 250,
      easy: { duration: 28, target: 1, rule: { direction: -1, progressScale: 2.5, jerkThreshold: 0.07, jerkVelocityThreshold: 2.8, jerkPenalty: 0.07 } },
      hard: { duration: 22, target: 1, rule: { direction: -1, progressScale: 1.55, jerkThreshold: 0.04, jerkVelocityThreshold: 1.7, jerkPenalty: 0.16 } }
    },
    {
      id: 'spinner', title: 'Miodarka',
      instruction: 'Kręć dłonią dużymi, zamaszystymi kołami jak prawdziwą korbą. Małe ruchy się nie liczą.',
      type: 'spin', points: 300,
      easy: { duration: 34, target: 3, rule: { targetTurns: 3, rhythmThreshold: 0.3, rhythmBonus: 0.2, chaosPenalty: 0.1, minMotion: 0.0012, minRadius: 0.2, minFit: 0.55, minCoverage: 0.32, minDirection: 0.42 } },
      hard: { duration: 27, target: 5, rule: { targetTurns: 5, rhythmThreshold: 0.55, rhythmBonus: 0.12, chaosPenalty: 0.2, minMotion: 0.002, minRadius: 0.2, minFit: 0.68, minCoverage: 0.48, minDirection: 0.58 } }
    },
    {
      id: 'fishing', title: 'Łowienie ryb',
      instruction: 'Zarzucaj wędkę ruchem ręki góra–dół. Gdy ryba bierze, szybko kręć małe koła nadgarstkiem.',
      type: 'fishing', points: 350,
      easy: {
        duration: 30, target: 5,
        rule: {
          castDirection: 'vertical', castMinTravel: 0.18, castMinVelocity: 0.4,
          reelMinRadius: 0.025, reelMaxRadius: 0.12, reelMinTurns: 1.25, reelMinSpeed: 1.4,
          fishSpawnArea: { xMin: 0.08, xMax: 0.92, yMin: 0.72, yMax: 0.9 },
          fishSpawnInterval: [1.4, 2.5]
        }
      },
      hard: {
        duration: 30, target: 8,
        rule: {
          castDirection: 'vertical', castMinTravel: 0.22, castMinVelocity: 0.55,
          reelMinRadius: 0.02, reelMaxRadius: 0.1, reelMinTurns: 1.75, reelMinSpeed: 1.9,
          fishSpawnArea: { xMin: 0.08, xMax: 0.92, yMin: 0.72, yMax: 0.9 },
          fishSpawnInterval: [0.9, 1.8]
        }
      }
    },
    {
      id: 'flying-ducks', title: 'Kaczki latające — pistolet',
      instruction: 'Ułóż dłoń jak pistolet: wyprostowany wskazujący i kciuk w górę. Gest strzela.',
      type: 'gun', points: 150,
      easy: { duration: 34, target: 8, rule: { hitRadius: 0.045, seriesBonus: 0.04, directionChangeChance: 0.012 } },
      hard: { duration: 27, target: 12, rule: { hitRadius: 0.032, seriesBonus: 0.025, directionChangeChance: 0.022 } }
    },
    {
      id: 'frogger', title: 'Frogger — skakanie',
      instruction: 'Obie ręce w górę — skok. Obie w dół — kucnięcie. Szybko machaj obiema rękami, aby przelecieć nad wodą.',
      type: 'frogger', points: 375,
      easy: { duration: 30, target: 8, rule: { obstacleSpeed: 0.00016, jumpDuration: 0.72, crouchDuration: 0.55, waveSpeed: 0.12, flightDuration: 0.9 } },
      hard: { duration: 30, target: 12, rule: { obstacleSpeed: 0.00023, jumpDuration: 0.62, crouchDuration: 0.45, waveSpeed: 0.16, flightDuration: 0.75 } }
    },
    // Kroniki Marcina — wyłączone w MVP (za duży projekt na imprezę)
    // { id: 'kroniki-marcina', type: 'chronicles', points: 450, ... }
  ];

  const apiaries = {
    siedlanowo: {
      id: 'siedlanowo', name: 'SIEDLANOWO', stage: 1,
      difficulty: 'łatwy', host: 'Marcin — początkujący pszczelarz',
      description: 'Spokojny start dla nowych pszczelarzy.',
      preset: 'easy', extraRound: false
    },
    paslek: {
      id: 'paslek', name: 'PASŁĘK', stage: 2,
      difficulty: 'zaawansowany', host: 'Henryk',
      description: 'Trudniejsze progi, ciaśniejsze cele i polowanie na dziczka.',
      preset: 'hard', extraRound: true
    }
  };

  const placeholderRound = {
    id: 'boars', title: 'Polowanie na dziczka',
    instruction: 'Wyceluj w biegnącego dziczka i uszczypnij, żeby strzelić. Dziki są szybkie!',
    type: 'boars', duration: 32, target: 8, points: 400,
    rule: {
      hitRadius: 0.035,
      minSpeed: 0.0008,
      directionChangeChance: 0.018,
      seriesBonus: 0.035,
      missPenalty: 0.015
    }
  };

  function getApiary(id) {
    return apiaries[id] || apiaries.siedlanowo;
  }

  function cloneRound(source, apiary) {
    const preset = source[apiary.preset];
    const round = Object.assign({}, source, preset, {
      rule: Object.assign({}, source.rule || {}, preset.rule || {}),
      apiaryId: apiary.id,
      difficulty: apiary.difficulty
    });
    delete round.easy;
    delete round.hard;
    return round;
  }

  function roundsFor(apiaryId) {
    const apiary = getApiary(apiaryId);
    const result = baseRounds.map(function (round) { return cloneRound(round, apiary); });
    if (apiary.extraRound) result.push(Object.assign({}, placeholderRound, { apiaryId: apiary.id, difficulty: apiary.difficulty }));
    return result;
  }

  function get(index, apiaryId) {
    const list = roundsFor(apiaryId);
    return list[Math.max(0, Math.min(list.length - 1, index))];
  }

  function count(apiaryId) { return roundsFor(apiaryId).length; }

  function makeTargets(countValue, seed) {
    let value = (seed || 1) >>> 0;
    const random = function () {
      value = (1664525 * value + 1013904223) >>> 0;
      return value / 4294967296;
    };
    const result = [];
    for (let i = 0; i < countValue; i += 1) {
      result.push({
        x: 0.12 + random() * 0.76,
        y: 0.22 + random() * 0.52,
        vx: (random() - 0.5) * 0.00018,
        vy: (random() - 0.5) * 0.00012,
        size: 18 + random() * 12,
        alive: true,
        phase: random() * Math.PI * 2
      });
    }
    return result;
  }

  function makeChroniclesQuestions(slides) {
    const source = Array.isArray(slides) ? slides : [];
    const birthYear = 1976;
    const currentYear = 2026;
    const pool = [];
    let chapter = '';
    source.forEach(function (slide, index) {
      if (slide && typeof slide.rozdzial === 'string' && slide.rozdzial.trim()) chapter = slide.rozdzial.trim().replace(/\s+/g, ' ');
      if (!slide || typeof slide.tekst !== 'string' || !slide.tekst.trim()) return;
      const ratio = source.length > 1 ? index / (source.length - 1) : 0;
      const estimatedYear = Math.round((birthYear + ratio * (currentYear - birthYear)) / 5) * 5;
      const explicitYear = Number(slide.rok || slide.year);
      pool.push({
        text: slide.tekst.trim(),
        chapter: chapter,
        year: Number.isFinite(explicitYear) && explicitYear > 0 ? explicitYear : estimatedYear,
        order: index
      });
    });
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 15).map(function (entry) {
      const options = [entry.year, entry.year - 5, entry.year + 5];
      for (let i = options.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }
      return { text: entry.text, chapter: entry.chapter, year: entry.year, options: options, correct: options.indexOf(entry.year), order: entry.order };
    });
  }

  root.Rounds = Object.freeze({
    all: Object.freeze(baseRounds.slice()),
    apiaries: Object.freeze(apiaries),
    placeholder: Object.freeze(placeholderRound),
    getApiary,
    roundsFor,
    get,
    count,
    makeTargets,
    makeChroniclesQuestions
  });
}(window));

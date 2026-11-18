/**
 * ============================================================================
 * quiz.js — مكوّن اختبار الوحدة (Quiz Block)
 * ============================================================================
 * مسؤولية واحدة: بناء اختبار قصير لوحدة تعليمية، تصحيحه فورياً مع شرح،
 * حفظ أفضل نتيجة، واستدعاء onPassed عند تحقيق نسبة النجاح.
 * يُستخدم من education.js فقط. البيانات من quizzes.js، الحالة من state.js.
 * ============================================================================
 */

import { quizzes, QUIZ_PASS_RATIO } from './quizzes.js';
import { getState, saveQuizScore } from './state.js';
import { createElement } from './utils.js';

/**
 * خلط فيشر-ييتس — يُرجع نسخة مخلوطة دون تعديل الأصل.
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
export function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * يحسب الحد الأدنى لعدد الإجابات الصحيحة للنجاح.
 * @param {number} total
 * @returns {number}
 */
export function passingScore(total) {
  return Math.ceil(total * QUIZ_PASS_RATIO);
}

/**
 * يبني كتلة الاختبار لوحدة معيّنة، أو null إن لم يوجد اختبار لها.
 * @param {string} moduleId
 * @param {(score:number,total:number)=>void} [onPassed] - تُستدعى عند النجاح.
 * @returns {HTMLElement|null}
 */
export function buildQuizBlock(moduleId, onPassed) {
  const quiz = quizzes[moduleId];
  if (!quiz) return null;

  const total = quiz.questions.length;
  const headingId = `quiz-heading-${moduleId}`;
  const questionsEl = createElement('div', { class: 'quiz__questions' });
  const resultEl = createElement('div', { class: 'quiz__result', role: 'status', 'aria-live': 'polite' });
  const bestEl = createElement('div', { class: 'quiz__best' });

  const root = createElement('section', { class: 'quiz', 'aria-labelledby': headingId, 'data-quiz-module': moduleId }, [
    createElement('h3', { class: 'accordion__subheading', id: headingId }, ['📝 اختبر نفسك']),
    bestEl,
    questionsEl,
    resultEl
  ]);

  let answered = 0;
  let correct = 0;

  function renderBest() {
    const best = getState('quizScores')[moduleId];
    bestEl.textContent = best ? `أفضل نتيجة: ${best.score}/${best.total}` : `النجاح يتطلب ${passingScore(total)} من ${total}`;
  }

  function renderQuestions() {
    answered = 0;
    correct = 0;
    resultEl.innerHTML = '';
    questionsEl.innerHTML = '';

    shuffle(quiz.questions).forEach((item, qIndex) => {
      const qId = `quiz-${moduleId}-q${qIndex}`;
      const options = shuffle(item.options.map((text, i) => ({ text, isCorrect: i === item.answer })));
      const feedback = createElement('div', { class: 'quiz__feedback', hidden: 'true' });

      const optionButtons = options.map((opt) =>
        createElement(
          'button',
          { class: 'quiz-option', type: 'button', 'data-correct': opt.isCorrect ? 'true' : 'false' },
          [opt.text]
        )
      );

      const block = createElement('div', { class: 'quiz__question', role: 'group', 'aria-labelledby': qId }, [
        createElement('div', { class: 'quiz__prompt', id: qId }, [`${qIndex + 1}. ${item.q}`]),
        createElement('div', { class: 'quiz__options' }, optionButtons),
        feedback
      ]);

      optionButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          if (block.dataset.answered === 'true') return;
          block.dataset.answered = 'true';
          answered += 1;

          const isRight = btn.dataset.correct === 'true';
          if (isRight) correct += 1;

          optionButtons.forEach((b) => {
            b.disabled = true;
            if (b.dataset.correct === 'true') b.dataset.state = 'correct';
          });
          if (!isRight) btn.dataset.state = 'incorrect';

          feedback.hidden = false;
          feedback.textContent = `${isRight ? '✅ صحيح. ' : '❌ غير صحيح. '}${item.why}`;

          if (answered === total) showResult();
        });
      });

      questionsEl.appendChild(block);
    });
  }

  function showResult() {
    const passed = correct >= passingScore(total);
    const prev = getState('quizScores')[moduleId];
    if (!prev || correct > prev.score) saveQuizScore(moduleId, correct, total);
    renderBest();

    const retryBtn = createElement('button', { class: 'btn btn--sm', type: 'button', 'data-quiz-action': 'retry' }, ['🔄 أعد المحاولة']);
    retryBtn.addEventListener('click', renderQuestions);

    resultEl.appendChild(
      createElement('div', { class: `alert-box ${passed ? 'alert-box--info' : 'alert-box--warning'}` }, [
        createElement('span', { 'aria-hidden': 'true' }, [passed ? '🏆' : '📖']),
        createElement('div', {}, [
          createElement('strong', {}, [`النتيجة: ${correct}/${total}`]),
          passed ? ' — أحسنت! تم تسجيل الوحدة كمكتملة.' : ' — راجع الوحدة وحاول مرة أخرى للإكمال.'
        ])
      ])
    );
    resultEl.appendChild(retryBtn);

    if (passed && typeof onPassed === 'function') onPassed(correct, total);
  }

  renderBest();
  renderQuestions();
  return root;
}

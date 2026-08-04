import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExerciseView } from './exercises';
import type { Exercise } from '../../lib/types';

function renderExercise(
  exercise: Exercise,
  overrides: Partial<Parameters<typeof ExerciseView>[0]> = {},
) {
  const onChange = vi.fn();
  const props = {
    exercise,
    value: '',
    onChange,
    checked: false,
    correct: false,
    ...overrides,
  };
  const view = render(<ExerciseView {...props} />);
  return { onChange, ...view };
}

describe('multiple choice', () => {
  const exercise: Exercise = {
    type: 'select',
    prompt: 'Get down!',
    instruction: 'Choose the Lithuanian',
    answer: 'Gulk!',
    options: ['Gulk!', 'Kelkis!', 'Stok!', 'Pirmyn!'],
    difficulty: 1,
  };

  it('shows the prompt and every option as a radio', () => {
    renderExercise(exercise);

    expect(screen.getByText('Get down!')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('reports the chosen option upwards', async () => {
    const user = userEvent.setup();
    const { onChange } = renderExercise(exercise);

    await user.click(screen.getByRole('radio', { name: /Gulk!/ }));
    expect(onChange).toHaveBeenCalledWith('Gulk!');
  });

  it('locks the options once the answer is checked', () => {
    renderExercise(exercise, { checked: true, correct: true, value: 'Gulk!' });

    for (const option of screen.getAllByRole('radio')) {
      expect(option).toBeDisabled();
    }
  });

  it('marks the chosen option and the right answer after checking', () => {
    renderExercise(exercise, { checked: true, correct: false, value: 'Stok!' });

    expect(screen.getByRole('radio', { name: /Stok!/ })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('typed answers', () => {
  const exercise: Exercise = {
    type: 'write',
    prompt: 'The enemy is on the left',
    answer: 'Priešas kairėje',
    difficulty: 3,
  };

  it('reports what the learner types', async () => {
    const user = userEvent.setup();
    const { onChange } = renderExercise(exercise);

    await user.type(screen.getByRole('textbox'), 'Priesas');
    expect(onChange).toHaveBeenCalled();
  });

  it('tells the learner diacritics are optional', () => {
    renderExercise(exercise);
    expect(screen.getByText(/Lithuanian letters are optional/i)).toBeInTheDocument();
  });

  it('goes read-only after checking', () => {
    renderExercise(exercise, { checked: true, correct: true, value: 'Priešas kairėje' });
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});

describe('fill in the blank', () => {
  const exercise: Exercise = {
    type: 'fill_blank',
    prompt: 'Priedanga po _____.',
    instruction: 'Fill the gap — “Cover under the bridge.”',
    answer: 'tiltu',
    difficulty: 3,
  };

  it('shows the sentence with the gap and the current guess in it', () => {
    renderExercise(exercise, { value: 'tiltu' });
    expect(screen.getAllByText('tiltu').length).toBeGreaterThan(0);
  });
});

describe('word bank', () => {
  const exercise: Exercise = {
    type: 'word_bank',
    prompt: 'Section, move!',
    answer: 'Skyrius, pirmyn!',
    tiles: ['pirmyn!', 'Skyrius,', 'Gulk!'],
    difficulty: 2,
  };

  it('builds the sentence from tapped tiles, in order', async () => {
    const user = userEvent.setup();
    const { onChange } = renderExercise(exercise);

    await user.click(screen.getByRole('button', { name: 'Skyrius,' }));
    await user.click(screen.getByRole('button', { name: 'pirmyn!' }));

    expect(onChange).toHaveBeenLastCalledWith('Skyrius, pirmyn!');
  });

  it('prompts the learner when nothing has been tapped yet', () => {
    renderExercise(exercise);
    expect(screen.getByText(/Tap the words below in order/i)).toBeInTheDocument();
  });
});

describe('match pairs', () => {
  const exercise: Exercise = {
    type: 'match',
    prompt: 'Match the pairs',
    answer: 'kairė|dešinė',
    pairs: [
      { lt: 'kairė', en: 'left' },
      { lt: 'dešinė', en: 'right' },
    ],
    difficulty: 1,
  };

  it('shows both columns and a running count', () => {
    renderExercise(exercise);

    expect(screen.getByRole('button', { name: 'kairė' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'left' })).toBeInTheDocument();
    expect(screen.getByText('0 of 2 matched')).toBeInTheDocument();
  });

  it('completes only when every pair is matched', async () => {
    const user = userEvent.setup();
    const { onChange } = renderExercise(exercise);

    await user.click(screen.getByRole('button', { name: 'kairė' }));
    await user.click(screen.getByRole('button', { name: 'left' }));
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'dešinė' }));
    await user.click(screen.getByRole('button', { name: 'right' }));
    expect(onChange).toHaveBeenCalledWith('kairė|dešinė');
  });
});

describe('command reaction', () => {
  const exercise: Exercise = {
    type: 'react',
    prompt: 'Ramiai!',
    instruction: 'What do you do?',
    audioText: 'Ramiai!',
    answer: 'Come to attention',
    options: ['Come to attention', 'Relax your stance', 'Take cover', 'Start marching'],
    difficulty: 2,
  };

  it('presents the shouted command and the possible reactions', () => {
    renderExercise(exercise);

    expect(screen.getByText('Ramiai!')).toBeInTheDocument();
    expect(screen.getByText('Shouted command — react')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });
});

describe('listening', () => {
  const exercise: Exercise = {
    type: 'listen_select',
    prompt: 'What did you hear?',
    audioText: 'Kontaktas!',
    answer: 'Contact!',
    options: ['Contact!', 'Cover!', 'Reloading!', 'Clear!'],
    difficulty: 2,
  };

  it('offers a replay button rather than showing the Lithuanian', () => {
    renderExercise(exercise);

    expect(screen.getByRole('button', { name: /Play .Kontaktas!./ })).toBeInTheDocument();
    expect(screen.queryByText('Kontaktas!')).not.toBeInTheDocument();
  });
});

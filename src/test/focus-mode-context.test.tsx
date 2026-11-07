import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FocusModeContext, useFocusMode } from '@/components/focus-mode-context';

function Consumer() {
  const { focusMode, setFocusMode } = useFocusMode();
  return <><span>{focusMode ? 'on' : 'off'}</span><button onClick={() => setFocusMode(!focusMode)}>toggle</button></>;
}

it('provides a safe default without a provider', () => {
  render(<Consumer />);
  expect(screen.getByText('off')).toBeInTheDocument();
  expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow();
});

it('updates consumers through a provider', () => {
  function TestProvider() {
    const [focusMode, setFocusMode] = useState(false);
    return <FocusModeContext.Provider value={{ focusMode, setFocusMode }}><Consumer /></FocusModeContext.Provider>;
  }
  render(<TestProvider />);
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText('on')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText('off')).toBeInTheDocument();
});

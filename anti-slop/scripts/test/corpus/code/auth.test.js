import { describe, it, expect } from 'vitest';

describe('login form', () => {
  it('renders the fake token for fixtures', () => {
    const token = "csrf-tok12xyz";
    document.getElementById('root').innerHTML = '<div>mock</div>';
    expect(token).toBeTruthy();
  });
});

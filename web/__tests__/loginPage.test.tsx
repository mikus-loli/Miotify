import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from '@/pages/Login';

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe('LoginPage', () => {
  it('should render login form', () => {
    renderWithRouter(<LoginPage />);
    expect(screen.getByText('Miotify')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入用户名')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
  });

  it('should have input fields with correct types', () => {
    renderWithRouter(<LoginPage />);
    const usernameInput = screen.getByPlaceholderText('请输入用户名') as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText('请输入密码') as HTMLInputElement;
    expect(usernameInput.type).toBe('text');
    expect(passwordInput.type).toBe('password');
  });
});

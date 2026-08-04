import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageCard from '@/components/MessageCard';
import type { Message } from '@/types';

const mockMessage: Message = {
  id: 1,
  appid: 1,
  message: 'Test message content',
  title: 'Test Title',
  priority: 5,
  created_at: '2026-01-01 12:00:00',
};

describe('MessageCard', () => {
  it('should render message title and content', () => {
    render(
      <MessageCard
        message={mockMessage}
        onDelete={() => {}}
      />
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test message content')).toBeInTheDocument();
  });

  it('should render priority badge for high priority', () => {
    render(
      <MessageCard
        message={mockMessage}
        onDelete={() => {}}
      />
    );
    // 组件实现：priority >= 5 显示「紧急」
    expect(screen.getByText('紧急')).toBeInTheDocument();
  });

  it('should render low priority badge', () => {
    const lowPriorityMsg = { ...mockMessage, priority: 0 };
    render(
      <MessageCard
        message={lowPriorityMsg}
        onDelete={() => {}}
      />
    );
    // 组件实现：priority < 2 显示「低」
    expect(screen.getByText('低')).toBeInTheDocument();
  });

  it('should render delete button', () => {
    render(
      <MessageCard
        message={mockMessage}
        onDelete={() => {}}
      />
    );
    expect(screen.getByTitle('删除')).toBeInTheDocument();
  });

  it('should render created_at timestamp', () => {
    render(
      <MessageCard
        message={mockMessage}
        onDelete={() => {}}
      />
    );
    // 组件通过 formatTime 格式化，'2026-01-01 12:00:00' 按 UTC 解析后转本地时间显示
    expect(screen.getByText(/2026\/01\/01/)).toBeInTheDocument();
  });
});

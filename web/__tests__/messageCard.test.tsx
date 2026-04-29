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
    expect(screen.getByText('高优先级')).toBeInTheDocument();
  });

  it('should render low priority badge', () => {
    const lowPriorityMsg = { ...mockMessage, priority: 0 };
    render(
      <MessageCard
        message={lowPriorityMsg}
        onDelete={() => {}}
      />
    );
    expect(screen.getByText('低优先级')).toBeInTheDocument();
  });

  it('should render delete button', () => {
    render(
      <MessageCard
        message={mockMessage}
        onDelete={() => {}}
      />
    );
    expect(screen.getByTitle('删除消息')).toBeInTheDocument();
  });

  it('should render created_at timestamp', () => {
    render(
      <MessageCard
        message={mockMessage}
        onDelete={() => {}}
      />
    );
    expect(screen.getByText('2026-01-01 12:00:00')).toBeInTheDocument();
  });
});

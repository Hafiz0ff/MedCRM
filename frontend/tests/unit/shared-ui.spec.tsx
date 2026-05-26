import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Skeleton, SkeletonCard, SkeletonTable } from '@/shared/ui/skeleton';

describe('Skeleton component', () => {
  it('renders skeleton element', () => {
    const { container } = render(<Skeleton height="20px" width="100px" />);
    const el = container.querySelector('.skeleton');
    expect(el).toBeInTheDocument();
  });

  it('renders SkeletonCard', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.querySelector('.skeleton-card')).toBeInTheDocument();
  });

  it('renders SkeletonTable', () => {
    const { container } = render(<SkeletonTable rows={3} />);
    expect(container.querySelector('.skeleton-table')).toBeInTheDocument();
  });
});

describe('ConfirmDialog component', () => {
  it('shows dialog content when open is true', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Удалить запись?"
        message="Вы уверены, что хотите удалить?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Удалить запись?')).toBeInTheDocument();
    expect(screen.getByText('Вы уверены, что хотите удалить?')).toBeInTheDocument();
  });

  it('calls the selected dialog action', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        cancelLabel="Оставить"
        confirmLabel="Удалить"
        message="Вы уверены, что хотите удалить?"
        onCancel={onCancel}
        onConfirm={onConfirm}
        open={true}
        title="Удалить запись?"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Оставить' }));
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

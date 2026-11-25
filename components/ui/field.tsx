import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { fieldLabel } from './tokens';

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  const child =
    isValidElement<{ id?: string }>(children) && !children.props.id
      ? cloneElement(children, { id })
      : children;

  return (
    <div className="block">
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      {child}
    </div>
  );
}

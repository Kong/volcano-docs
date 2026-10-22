interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: React.ReactNode;
}

// A labelled input; every other prop is passed to the <input>
export default function FormField({ id, label, ...inputProps }: FormFieldProps) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <input id={id} {...inputProps} />
    </div>
  );
}

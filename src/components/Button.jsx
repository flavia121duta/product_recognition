function Button({ label, onClick, disabled = false, type = "primary" }) {
  return (
    <button
      type="button" 
      className={`btn ${type == "primary" ? "btn-success": "btn-outline-dark"} px-4 py-2 rounded-pill`}
      onClick={onClick}
      disabled={disabled}
    >
        {label}
    </button>
  );
}

export default Button;
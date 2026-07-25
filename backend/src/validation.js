// RF05: validação de campos obrigatórios e formatos (CPF, data, e-mail).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidCpf(cpf) {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const calcCheckDigit = (base) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += Number(base[i]) * (base.length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = calcCheckDigit(digits.slice(0, 9));
  const d2 = calcCheckDigit(digits.slice(0, 10));
  return d1 === Number(digits[9]) && d2 === Number(digits[10]);
}

export function validatePatientInput(body) {
  const errors = [];

  if (!body.full_name || !body.full_name.trim()) {
    errors.push("Nome completo é obrigatório");
  }

  if (!body.birth_date || !DATE_RE.test(body.birth_date)) {
    errors.push("Data de nascimento é obrigatória e deve estar no formato AAAA-MM-DD");
  } else if (new Date(body.birth_date) > new Date()) {
    errors.push("Data de nascimento não pode ser futura");
  }

  if (body.cpf && !isValidCpf(body.cpf)) {
    errors.push("CPF inválido");
  }

  if (body.email && !EMAIL_RE.test(body.email)) {
    errors.push("E-mail inválido");
  }

  return errors;
}

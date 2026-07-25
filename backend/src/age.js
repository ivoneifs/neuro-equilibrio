// RF02/RF03: calcula idade (anos, meses, dias) em uma data de referência,
// não apenas a idade atual — usado em todos os testes que exigem faixa etária.
export function calculateAge(birthDateStr, referenceDateStr = new Date().toISOString().slice(0, 10)) {
  const birth = new Date(birthDateStr + "T00:00:00");
  const reference = new Date(referenceDateStr + "T00:00:00");

  if (Number.isNaN(birth.getTime())) throw new Error("Data de nascimento inválida");
  if (Number.isNaN(reference.getTime())) throw new Error("Data de referência inválida");
  if (birth > reference) throw new Error("Data de nascimento posterior à data de referência");

  let years = reference.getFullYear() - birth.getFullYear();
  let months = reference.getMonth() - birth.getMonth();
  let days = reference.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    const daysInPrevMonth = new Date(reference.getFullYear(), reference.getMonth(), 0).getDate();
    days += daysInPrevMonth;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days };
}

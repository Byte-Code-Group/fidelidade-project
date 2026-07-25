// Casos de teste das regras de agenda (lib/scheduling.ts).
// Rodar: pnpm test:scheduling
import {
  zonedToUtc, partesNoFuso, slotsLivres, subtrairBlocos, normalizarBlocos,
  gradeDoMes, somarDias, weekdayDaData, mesSeguinte, mesAnterior,
  minutosDoHorario, horarioDeMinutos, formatarDuracao, formatarMes, seSobrepoe,
} from "../lib/scheduling";

let falhas = 0;
const eq = (nome: string, got: unknown, esperado: unknown) => {
  const a = JSON.stringify(got), b = JSON.stringify(esperado);
  if (a !== b) { falhas++; console.log("FAIL", nome, "\n  got:", a, "\n  esperado:", b); }
  else console.log("PASS", nome, "→", a);
};

// fuso
eq("09:00 BRT → UTC 12:00", zonedToUtc("2026-07-30", "09:00").toISOString(), "2026-07-30T12:00:00.000Z");
eq("volta pro fuso", partesNoFuso("2026-07-30T12:00:00.000Z"), { date: "2026-07-30", time: "09:00", weekday: 4, minutos: 540 });
eq("meia-noite local", zonedToUtc("2026-01-01", "00:00").toISOString(), "2026-01-01T03:00:00.000Z");
eq("ida e volta preserva", partesNoFuso(zonedToUtc("2026-12-25", "23:30")).time, "23:30");

// horas
eq("minutos", minutosDoHorario("09:30:00"), 570);
eq("horario", horarioDeMinutos(570), "09:30");

// blocos
eq("normaliza junta", normalizarBlocos([{start:60,end:120},{start:110,end:180}]), [{start:60,end:180}]);
eq("subtrai almoço", subtrairBlocos([{start:480,end:1080}], [{start:720,end:780}]), [{start:480,end:720},{start:780,end:1080}]);
eq("subtrai dia todo", subtrairBlocos([{start:480,end:1080}], [{start:0,end:1440}]), []);
eq("fim exclusivo não sobrepõe", seSobrepoe({start:540,end:570},{start:570,end:600}), false);

// slots
const trabalho = [{ start: 8 * 60, end: 12 * 60 }];
eq("slots de 30min 08-12 passo 30",
  slotsLivres({ dateISO: "2026-08-10", trabalho, ocupado: [], duracao: 30, passo: 30, agora: new Date("2026-07-01T12:00:00Z") }),
  ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30"]);
eq("ocupado 09:00-09:30 tira slot",
  slotsLivres({ dateISO: "2026-08-10", trabalho, ocupado: [{start:540,end:570}], duracao: 30, passo: 30, agora: new Date("2026-07-01T12:00:00Z") }),
  ["08:00","08:30","09:30","10:00","10:30","11:00","11:30"]);
eq("duração 60 em janela de 90min",
  slotsLivres({ dateISO: "2026-08-10", trabalho: [{start:600,end:690}], ocupado: [], duracao: 60, passo: 30, agora: new Date("2026-07-01T12:00:00Z") }),
  ["10:00","10:30"]);
eq("duração 60 em janela exata de 60min",
  slotsLivres({ dateISO: "2026-08-10", trabalho: [{start:600,end:660}], ocupado: [], duracao: 60, passo: 30, agora: new Date("2026-07-01T12:00:00Z") }),
  ["10:00"]);
eq("duração maior que a janela não gera slot",
  slotsLivres({ dateISO: "2026-08-10", trabalho: [{start:600,end:640}], ocupado: [], duracao: 60, passo: 30, agora: new Date("2026-07-01T12:00:00Z") }),
  []);
eq("data passada não oferece nada",
  slotsLivres({ dateISO: "2026-06-01", trabalho, ocupado: [], duracao: 30, agora: new Date("2026-07-01T12:00:00Z") }), []);
eq("hoje só depois de agora+antecedência",
  slotsLivres({ dateISO: "2026-07-01", trabalho: [{start:8*60,end:11*60}], ocupado: [], duracao: 30, passo: 30, antecedenciaMin: 60, agora: new Date("2026-07-01T12:00:00Z") }),
  ["10:00","10:30"]);
eq("alinha ao passo", slotsLivres({ dateISO: "2026-08-10", trabalho: [{start:487,end:600}], ocupado: [], duracao: 30, passo: 15, agora: new Date("2026-07-01T12:00:00Z") })[0], "08:15");

// calendário
eq("grade jul/2026 tem semanas completas", (() => { const g = gradeDoMes("2026-07"); return [g.length % 7, g[0], g[g.length-1], weekdayDaData(g[0])]; })(), [0, "2026-06-28", "2026-08-01", 0]);
eq("mês seguinte vira ano", mesSeguinte("2026-12"), "2027-01");
eq("mês anterior vira ano", mesAnterior("2026-01"), "2025-12");
eq("somar dias cruza mês", somarDias("2026-01-31", 1), "2026-02-01");
eq("formata mês", formatarMes("2026-07"), "julho de 2026");
eq("duração", [formatarDuracao(45), formatarDuracao(60), formatarDuracao(90)], ["45 min","1h","1h30"]);

console.log(falhas === 0 ? "\nTODOS OS CASOS PASSARAM" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);

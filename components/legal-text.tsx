import type { ReactNode } from "react";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-[14px] font-semibold text-gray-900">{title}</h3>
      <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-gray-600">{children}</div>
    </section>
  );
}

export function TermosDeUso() {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13px] leading-relaxed text-gray-600">
        Ao criar uma conta na Fidelidade, você concorda com as condições abaixo. Leia com atenção
        antes de continuar.
      </p>

      <Section title="1. O serviço">
        <p>
          A Fidelidade é uma plataforma que permite ao seu negócio criar um portal de fidelidade
          próprio, com carteirinha digital, pontos, recompensas, loja de benefícios e atendimento
          automatizado. O acesso é feito por assinatura, conforme o plano escolhido.
        </p>
      </Section>

      <Section title="2. Sua conta">
        <p>
          Você é responsável pelos dados informados no cadastro e por manter sua senha em sigilo.
          Toda atividade realizada com suas credenciais é considerada como sua. Avise-nos
          imediatamente se suspeitar de uso não autorizado.
        </p>
      </Section>

      <Section title="3. Planos e pagamento">
        <p>
          A assinatura é cobrada de forma recorrente pelo valor e periodicidade do plano
          contratado. O processamento do pagamento é feito por parceiro externo. O acesso aos
          recursos pagos permanece ativo enquanto a assinatura estiver em dia; em caso de
          inadimplência, o portal pode ser suspenso.
        </p>
      </Section>

      <Section title="4. Cancelamento">
        <p>
          Você pode cancelar a assinatura a qualquer momento pelo painel. O cancelamento
          interrompe as cobranças seguintes e o acesso segue disponível até o fim do período já
          pago. Não há reembolso proporcional de períodos em andamento.
        </p>
      </Section>

      <Section title="5. Uso adequado">
        <p>
          Não é permitido usar a plataforma para atividades ilegais, envio de mensagens não
          solicitadas, violação de direitos de terceiros ou tentativas de comprometer a segurança
          do sistema. Podemos suspender contas que descumpram estas regras.
        </p>
      </Section>

      <Section title="6. Conteúdo e dados do seu negócio">
        <p>
          Os dados que você cadastra (clientes, campanhas, recompensas, marca) continuam sendo
          seus. Nós apenas os processamos para operar o serviço, conforme a Política de
          Privacidade.
        </p>
      </Section>

      <Section title="7. Disponibilidade e limitação de responsabilidade">
        <p>
          Trabalhamos para manter o serviço disponível, mas ele pode passar por manutenções e
          interrupções eventuais. A Fidelidade não se responsabiliza por lucros cessantes ou danos
          indiretos decorrentes do uso ou da indisponibilidade da plataforma.
        </p>
      </Section>

      <Section title="8. Alterações">
        <p>
          Estes termos podem ser atualizados. Mudanças relevantes serão comunicadas pelo painel ou
          por e-mail. O uso continuado após a comunicação indica concordância com a nova versão.
        </p>
      </Section>
    </div>
  );
}

export function PoliticaDePrivacidade() {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13px] leading-relaxed text-gray-600">
        Esta política explica quais dados a Fidelidade coleta, por que coleta e como você pode
        controlá-los, em linha com a Lei Geral de Proteção de Dados (LGPD).
      </p>

      <Section title="1. Dados que coletamos">
        <p>
          <strong className="font-medium text-gray-800">Da sua conta:</strong> nome, e-mail, senha
          (armazenada de forma criptografada) e dados do negócio que você cadastra.
        </p>
        <p>
          <strong className="font-medium text-gray-800">Dos seus clientes:</strong> as informações
          que você ou eles registram no portal de fidelidade, como nome, contato, pontos e
          histórico de resgates.
        </p>
        <p>
          <strong className="font-medium text-gray-800">De uso:</strong> registros técnicos de
          acesso, necessários para segurança e funcionamento do serviço.
        </p>
      </Section>

      <Section title="2. Para que usamos">
        <p>
          Para criar e manter sua conta, operar o portal e suas funcionalidades, processar
          cobranças da assinatura, dar suporte, prevenir fraudes e cumprir obrigações legais.
        </p>
      </Section>

      <Section title="3. Compartilhamento">
        <p>
          Não vendemos seus dados. Compartilhamos apenas com prestadores necessários à operação —
          como hospedagem, banco de dados e processamento de pagamentos — que tratam os dados sob
          nossa instrução, ou quando exigido por lei.
        </p>
      </Section>

      <Section title="4. Seu papel em relação aos clientes">
        <p>
          Os dados dos clientes cadastrados no seu portal são controlados por você. Cabe a você
          obter o consentimento necessário e usá-los apenas para a finalidade do programa de
          fidelidade. A Fidelidade atua como operadora desses dados.
        </p>
      </Section>

      <Section title="5. Segurança">
        <p>
          Usamos criptografia em trânsito, controle de acesso por perfil e isolamento de dados
          entre portais. Nenhum sistema é totalmente imune a incidentes, mas mantemos práticas
          para reduzir riscos e comunicar eventuais ocorrências.
        </p>
      </Section>

      <Section title="6. Retenção">
        <p>
          Mantemos os dados enquanto sua conta estiver ativa. Após o encerramento, eles são
          excluídos ou anonimizados, salvo o que precisarmos guardar por obrigação legal ou
          fiscal.
        </p>
      </Section>

      <Section title="7. Seus direitos">
        <p>
          Você pode solicitar acesso, correção, portabilidade, exclusão dos seus dados ou revogar
          consentimentos. Basta entrar em contato pelo canal de suporte informado no painel.
        </p>
      </Section>

      <Section title="8. Cookies">
        <p>
          Utilizamos cookies essenciais para manter sua sessão autenticada. Eles não são usados
          para publicidade de terceiros.
        </p>
      </Section>
    </div>
  );
}

# Journal

## Prerequisites

Its assumed you have a local development environment with the tools you need, including but not limited to:

- Visual Studio Code and hve-core-all extension
- CLI tools: az, gh, copilot, jq, rg, git-credential-manager

## Steps followed in rough order

First we will brainstorm and build our idea into a design document. We can workshop our original inspiration with an agent. Once we have the initial design document, we use Design Thinking to validate and refine it. We can spend as much time as we like on the design thinking exercise. By the end, we should have a more refined and validated design document.

1. Vibe out GDD using regular agent mode -> results in game-design-document.md
1. Design thinking exercise on GDD using DT Coach agent -> refines GDD
1. Use prompt builder to build prompt for CICD 7-point harness creation
1. Build CICD harness research using Task researcher agent, providing prompt built in previous step
1. Build plan for harness using Task planner agent.
1. Implement harness using Task implementor agent.
1. Use prompt builder to prepare backlog creation prompt by using GDD and implemented 7 point harness as additional context.
1. Use prompt built in previous step with GitHub Backlog Manager agent to create backlog as issues in GitHub. Be sure to enable tool execution for this agent, as it was not enabled for me.
    - Spend time grooming backlog using agents and your own judgement and experience.
    - Dont worry if you havent thought of everything. You can add more issues later.
1. RPI your first epic/issue
    - Use your own judgement. Carefully review the planning artifact to be sure that it makes sense. For example, in my first epic, it wasnt aligned to Colyseus and would have built custom session connection management instead of using Colyseus. This was corrected after a second pass of the plan. It also didnt consider that we were planning to use Entra external identities for auth. I steered it to update the first task for both of these platform dependencies. Note that I had preselected this architecture based on other experience, but its perfectly valid to workshop both of these choices also and reach different conclusions.
    - Identified another gap, no entra client side auth flow available means no way to get an actual entra token without tedious direct API calls and token manipulation. Sent Task Researcher and planner back to identify gaps and then backlog manager to update issues to reflect missing clientside logic.

### CI/CD Harness

The CI/CD harness was built as the deployment and release infrastructure for the project. See [cicd-harness.md](cicd-harness.md) for the complete specification, including:

- GitHub Actions workflows for CI and release promotion (dev/prod)
- Secret management strategy using GitHub Environments
- Security and policy gates (dependency and container scanning)
- Post-deploy verification gates
- Rollback procedures
- Operations and incident triage checklist

>**Note:** At times you may need to help agents along the way by steering them on the right path, correcting invalid assumptions, installing missing tools, or other support. Agents attempt to do what you tell them, and often get it wrong.

>**Note:** Start new Copilot sessions for each new task. Monitor context usage to ensure sufficient tokens are available for quality responses. For this project, I kept model selection on "Auto" for every task.

>**Note:** Avoid yolo mode if possible. Knowing what tool the agent is executing at each step helps with understanding the agent's approach to your instruction. Agents with unfettered tool access WILL get you into trouble eventually.
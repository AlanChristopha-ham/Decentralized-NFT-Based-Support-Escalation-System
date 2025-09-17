# SupportTier: Decentralized NFT-Based Support Escalation System

## Overview

**SupportTier** is a Web3 project built on the Stacks blockchain using Clarity smart contracts. It leverages NFT feature access tiers to create a transparent, decentralized system for addressing user complaints in online communities, DAOs, or service platforms. Users hold NFTs representing their support tier (e.g., Basic, Premium, Enterprise), which grant escalating levels of virtual (e.g., priority chat access, AI-assisted resolution) or in-person (e.g., event meetups, dedicated consultations) support.

### Real-World Problems Solved
- **Inefficient Customer Support**: Traditional support systems are centralized, slow, and opaque, leading to unresolved complaints and user churn. SupportTier automates escalation via on-chain logic, ensuring fair upgrades without human bias.
- **Community Engagement in Web3**: DAOs and NFT projects often face complaints about governance or services. This system incentivizes participation by tying support upgrades to complaint resolution, fostering trust and retention.
- **Accessibility Gaps**: Low-tier users get basic virtual support (e.g., forums), while escalated complaints unlock premium virtual (e.g., live video calls) or in-person benefits (e.g., conference passes), bridging digital-physical divides in remote work or global communities.
- **Transparency and Accountability**: All complaints and upgrades are on-chain, auditable, and verifiable, reducing disputes in high-stakes environments like DeFi or social platforms.

The system uses NFTs as "keys" to gated support resources, with smart contracts handling minting, complaint submission, automated escalation, voting, access control, and incentives. This creates a gamified, self-sustaining ecosystem where resolved complaints reward both users and support providers (e.g., via tokens).

### Key Features
- **Tiered NFTs**: Mint NFTs for tiers (Basic: free/virtual forums; Silver: paid/virtual priority; Gold: premium/in-person events).
- **Complaint Submission**: Users submit on-chain complaints with evidence (e.g., IPFS links).
- **Automated Escalation**: Smart contracts evaluate complaint severity (e.g., via simple scoring or oracle input) to upgrade NFT tiers temporarily or permanently.
- **Community Governance**: DAO voting for disputed escalations.
- **Support Access Gates**: NFTs unlock virtual (API calls to chat bots) or in-person (QR-code verified events) benefits.
- **Incentives**: Resolved complaints mint reward tokens; unresolved ones penalize providers.

The project involves **6 solid Clarity smart contracts** for core functionality, ensuring security, immutability, and composability on Stacks.

## Architecture

### Smart Contracts (All in Clarity)
1. **NFTMinting.clar** (NFT Core Contract)
   - Handles minting of tiered NFTs (SIP-009 standard).
   - Functions: `mint-tier-nft` (user pays STX/tokens for tier), `burn-nft` (downgrade), `get-tier-level` (query current tier).
   - Traits: Fungible for tiers, non-fungible for unique user NFTs.
   - Security: Access control via principal verification; prevents unauthorized mints.

2. **ComplaintSubmission.clar** (Complaint Handling)
   - Allows users to submit complaints tied to their NFT.
   - Functions: `submit-complaint` (includes description, severity score, IPFS evidence hash), `update-complaint-status` (mark as resolved/escalated).
   - Integrates with oracles for external verification (e.g., via Chainlink on Stacks).
   - Security: Rate-limiting to prevent spam; requires NFT ownership.

3. **EscalationEngine.clar** (Automated Upgrades)
   - Evaluates complaints and upgrades NFT tiers based on rules (e.g., severity > 7/10 auto-upgrades to Silver for 30 days).
   - Functions: `evaluate-escalation` (computes score from submission data), `upgrade-tier` (transfers NFT to higher tier contract), `revert-upgrade` (if unresolved).
   - Uses timers (Stacks blocks) for temporary upgrades.
   - Security: Multi-sig approval for permanent upgrades; overflow checks on scores.

4. **DAOVoting.clar** (Governance Layer)
   - Enables community voting on escalations (e.g., for Gold-tier disputes).
   - Functions: `propose-vote` (from escalation engine), `cast-vote` (NFT holders vote with weight by tier), `tally-results` (executes upgrade if >50% approval).
   - Quadratic voting to prevent whale dominance.
   - Security: Time-bound voting (e.g., 7-day window); replay protection via proposal IDs.

5. **AccessControl.clar** (Support Gatekeeper)
   - Gates access to virtual/in-person support.
   - Functions: `verify-access` (checks NFT tier for API keys or event tickets), `grant-virtual-support` (emits event for off-chain chat access), `redeem-in-person` (burns temporary token for physical verification).
   - Integrates with off-chain services (e.g., webhooks for Zoom links).
   - Security: Zero-knowledge proofs for privacy in verifications; expiry on access tokens.

6. **IncentiveManager.clar** (Rewards and Penalties)
   - Manages token rewards for resolutions (e.g., mint SUPPORT tokens).
   - Functions: `reward-resolution` (transfers tokens to user/provider), `apply-penalty` (slashes provider stake on unresolved complaints), `stake-provider` (providers lock STX for accountability).
   - Uses a simple token standard (SIP-010 for fungible tokens).
   - Security: Balance checks; cap on rewards to prevent inflation.

These contracts are interconnected: Complaints trigger escalation, which may invoke voting, ultimately updating NFTs and access. Total gas efficiency is optimized for Stacks' low fees.

### Tech Stack
- **Blockchain**: Stacks (Clarity language).
- **Frontend**: React + Hiro Wallet for interactions (not included in repo).
- **Storage**: IPFS for complaint evidence.
- **Oracles**: Optional integration with Stacks oracles for real-world data (e.g., complaint validity).
- **Testing**: Clarinet for unit/integration tests.
- **Deployment**: Via Clarinet CLI on Stacks testnet/mainnet.

### Deployment Flow
1. Deploy contracts in order: NFTMinting → ComplaintSubmission → EscalationEngine → DAOVoting → AccessControl → IncentiveManager.
2. Initialize with admin principal (e.g., deployer's address).
3. Mint initial provider stakes via IncentiveManager.

## Installation and Setup

### Prerequisites
- Rust and Clarinet installed (see [Stacks Docs](https://docs.stacks.co/clarinet)).
- Node.js for any frontend scripts.
- Hiro Wallet for testing transactions.

### Quick Start
1. Clone the repo:
   ```
   git clone <repo-url>
   cd supporttier
   ```
2. Install dependencies:
   ```
   clarinet integrate
   npm install  # If using frontend examples
   ```
3. Run tests:
   ```
   clarinet test
   ```
   - Includes scenarios: Mint NFT → Submit complaint → Auto-escalate → Vote → Access support → Reward.
4. Deploy to local/devnet:
   ```
   clarinet deploy --network devnet
   ```
   - Update `Clarity.toml` for contract paths.
5. Interact via Clarinet console or frontend:
   - Example: `(contract-call? .nft-minting mint-tier-nft tx-sender 1 u1000)` (mints Silver tier for 1000 STX).

### Contract Files
- All `.clar` files in `/contracts/` directory.
- Example snippet from `EscalationEngine.clar`:
  ```clarity
  (define-public (evaluate-escalation (complaint-id uint))
    (let ((complaint (unwrap! (get-complaint complaint-id) (err u5000)))
          (severity (get severity complaint)))
      (if (> severity u7)
          (as-contract (contract-call? .nft-minting upgrade-tier tx-sender))
          (ok true))))
  ```

## Usage Examples
- **User Flow**: Mint NFT → Submit complaint via frontend → Engine auto-upgrades tier → Access premium support → Resolve and claim rewards.
- **Provider Flow**: Stake in IncentiveManager → Resolve complaints to earn tokens → Avoid penalties.
- **Governance**: High-severity complaints trigger DAO vote for permanent upgrades.

## Roadmap
- **v1.0**: Core contracts and testnet deployment.
- **v1.1**: Frontend dashboard for submissions/voting.
- **v2.0**: Cross-chain integration (e.g., Bitcoin L2 via Stacks).
- **Audits**: Plan for third-party audit before mainnet.

## Contributing
- Fork and PR improvements to contracts or docs.
- Report issues for edge cases (e.g., spam prevention).

## License
MIT License. See LICENSE file.
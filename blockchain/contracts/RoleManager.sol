// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title RoleManager
 * @notice On-chain RBAC — maps Ethereum addresses to supply chain roles.
 *         The web backend calls this before writing to HalalRegistry or
 *         SupplyChainTracker to confirm the sender's authority.
 */
contract RoleManager {
    enum Role {
        NONE,         // 0 — unregistered
        ADMIN,        // 1
        SUPPLIER,     // 2
        MANUFACTURER, // 3
        LOGISTICS,    // 4
        RETAILER      // 5
    }

    address public owner;
    mapping(address => Role) private _roles;

    event RoleAssigned(address indexed account, Role role);
    event RoleRevoked(address indexed account);

    error NotOwner();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        _roles[msg.sender] = Role.ADMIN;
        emit RoleAssigned(msg.sender, Role.ADMIN);
    }

    function assignRole(address account, Role role) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        _roles[account] = role;
        emit RoleAssigned(account, role);
    }

    function revokeRole(address account) external onlyOwner {
        _roles[account] = Role.NONE;
        emit RoleRevoked(account);
    }

    function getRole(address account) external view returns (Role) {
        return _roles[account];
    }

    function hasRole(address account, Role role) external view returns (bool) {
        return _roles[account] == role;
    }

    function isAdmin(address account) external view returns (bool) {
        return _roles[account] == Role.ADMIN;
    }
}

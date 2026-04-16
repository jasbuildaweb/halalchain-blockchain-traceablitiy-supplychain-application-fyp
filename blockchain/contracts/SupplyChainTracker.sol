// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./RoleManager.sol";

/**
 * @title SupplyChainTracker
 * @notice Immutable, append-only audit log for every product's journey.
 *         Each call to recordEvent() emits a permanent on-chain event AND
 *         stores the struct for direct view-function queries.
 *
 *         Role → Permitted event types:
 *           SUPPLIER      → RAW_MATERIAL_ADDED
 *           MANUFACTURER  → MANUFACTURING_STARTED, MANUFACTURING_COMPLETE, QUALITY_CHECK_PASSED
 *           LOGISTICS     → SHIPPED, IN_TRANSIT, RECEIVED_AT_WAREHOUSE
 *           RETAILER      → DELIVERED_TO_RETAILER, AVAILABLE_FOR_SALE
 *           ADMIN         → any
 */
contract SupplyChainTracker {
    enum EventType {
        RAW_MATERIAL_ADDED,       // 0 — Supplier
        MANUFACTURING_STARTED,    // 1 — Manufacturer
        MANUFACTURING_COMPLETE,   // 2 — Manufacturer
        QUALITY_CHECK_PASSED,     // 3 — Manufacturer
        SHIPPED,                  // 4 — Logistics
        IN_TRANSIT,               // 5 — Logistics
        RECEIVED_AT_WAREHOUSE,    // 6 — Logistics
        DELIVERED_TO_RETAILER,    // 7 — Retailer
        AVAILABLE_FOR_SALE        // 8 — Retailer
    }

    struct ChainEvent {
        bytes32   eventId;
        bytes32   productId;
        EventType eventType;
        address   actor;
        uint256   timestamp;
        string    location;
        string    notes;
    }

    RoleManager public roleManager;

    // productId → ordered list of events
    mapping(bytes32 => ChainEvent[]) private _history;

    event SupplyChainEventRecorded(
        bytes32   indexed productId,
        bytes32   indexed eventId,
        EventType         eventType,
        address   indexed actor,
        uint256           timestamp,
        string            location,
        string            notes
    );

    error NotAuthorized();
    error RoleNotPermittedForEventType(RoleManager.Role role, EventType eventType);

    constructor(address _roleManager) {
        roleManager = RoleManager(_roleManager);
    }

    // ─── Record Event ─────────────────────────────────────────────────────

    function recordEvent(
        bytes32   productId,
        EventType eventType,
        string calldata location,
        string calldata notes
    ) external {
        RoleManager.Role role = roleManager.getRole(msg.sender);
        if (role == RoleManager.Role.NONE) revert NotAuthorized();

        _checkPermission(role, eventType);

        bytes32 eventId = keccak256(
            abi.encodePacked(productId, eventType, msg.sender, block.timestamp, block.number)
        );

        _history[productId].push(ChainEvent({
            eventId:   eventId,
            productId: productId,
            eventType: eventType,
            actor:     msg.sender,
            timestamp: block.timestamp,
            location:  location,
            notes:     notes
        }));

        emit SupplyChainEventRecorded(
            productId,
            eventId,
            eventType,
            msg.sender,
            block.timestamp,
            location,
            notes
        );
    }

    // ─── Views ────────────────────────────────────────────────────────────

    function getProductHistory(bytes32 productId)
        external
        view
        returns (ChainEvent[] memory)
    {
        return _history[productId];
    }

    function getEventCount(bytes32 productId) external view returns (uint256) {
        return _history[productId].length;
    }

    function getEvent(bytes32 productId, uint256 index)
        external
        view
        returns (ChainEvent memory)
    {
        return _history[productId][index];
    }

    // ─── Internal ─────────────────────────────────────────────────────────

    function _checkPermission(RoleManager.Role role, EventType eventType) internal pure {
        if (role == RoleManager.Role.ADMIN) return; // admin can record any

        if (role == RoleManager.Role.SUPPLIER) {
            if (eventType != EventType.RAW_MATERIAL_ADDED)
                revert RoleNotPermittedForEventType(role, eventType);
            return;
        }
        if (role == RoleManager.Role.MANUFACTURER) {
            if (
                eventType != EventType.MANUFACTURING_STARTED &&
                eventType != EventType.MANUFACTURING_COMPLETE &&
                eventType != EventType.QUALITY_CHECK_PASSED
            ) revert RoleNotPermittedForEventType(role, eventType);
            return;
        }
        if (role == RoleManager.Role.LOGISTICS) {
            if (
                eventType != EventType.SHIPPED &&
                eventType != EventType.IN_TRANSIT &&
                eventType != EventType.RECEIVED_AT_WAREHOUSE
            ) revert RoleNotPermittedForEventType(role, eventType);
            return;
        }
        if (role == RoleManager.Role.RETAILER) {
            if (
                eventType != EventType.DELIVERED_TO_RETAILER &&
                eventType != EventType.AVAILABLE_FOR_SALE
            ) revert RoleNotPermittedForEventType(role, eventType);
            return;
        }
        revert NotAuthorized();
    }
}

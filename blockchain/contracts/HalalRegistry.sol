// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./RoleManager.sol";

/**
 * @title HalalRegistry
 * @notice Registry of products and their halal certification state.
 *         - Manufacturers register products (bytes32 productId).
 *         - Admins issue / revoke halal certificates.
 *         - Anyone can query isHalalCertified() — used by the public /verify page.
 */
contract HalalRegistry {
    struct Product {
        bytes32 productId;
        string  name;
        address registeredBy;   // manufacturer wallet
        uint256 registeredAt;
        bool    isHalalCertified;
        bytes32 certificateId;
        bool    exists;
    }

    struct Certificate {
        bytes32 certificateId;
        bytes32 productId;
        string  issuingBody;    // e.g. "JAKIM", "MUI"
        uint256 issuedAt;
        uint256 expiresAt;
        bool    isValid;
    }

    RoleManager public roleManager;

    mapping(bytes32 => Product)     public products;
    mapping(bytes32 => Certificate) public certificates;

    // Track all product IDs for enumeration
    bytes32[] private _productIds;

    event ProductRegistered(
        bytes32 indexed productId,
        address indexed manufacturer,
        string  name,
        uint256 timestamp
    );
    event CertificateIssued(
        bytes32 indexed productId,
        bytes32 indexed certificateId,
        string  issuingBody,
        uint256 expiresAt
    );
    event CertificateRevoked(
        bytes32 indexed certificateId,
        bytes32 indexed productId,
        uint256 timestamp
    );

    error ProductAlreadyExists(bytes32 productId);
    error ProductNotFound(bytes32 productId);
    error CertificateNotFound(bytes32 certificateId);
    error NotAuthorized();
    error CertificateExpired();

    constructor(address _roleManager) {
        roleManager = RoleManager(_roleManager);
    }

    modifier onlyManufacturer() {
        if (!roleManager.hasRole(msg.sender, RoleManager.Role.MANUFACTURER) &&
            !roleManager.isAdmin(msg.sender)) revert NotAuthorized();
        _;
    }

    modifier onlyAdmin() {
        if (!roleManager.isAdmin(msg.sender)) revert NotAuthorized();
        _;
    }

    // ─── Product Registration ───────────────────────────────────────────────

    function registerProduct(
        bytes32 productId,
        string calldata name
    ) external onlyManufacturer {
        if (products[productId].exists) revert ProductAlreadyExists(productId);

        products[productId] = Product({
            productId:        productId,
            name:             name,
            registeredBy:     msg.sender,
            registeredAt:     block.timestamp,
            isHalalCertified: false,
            certificateId:    bytes32(0),
            exists:           true
        });

        _productIds.push(productId);

        emit ProductRegistered(productId, msg.sender, name, block.timestamp);
    }

    // ─── Certification ──────────────────────────────────────────────────────

    function issueCertificate(
        bytes32 productId,
        bytes32 certificateId,
        string calldata issuingBody,
        uint256 expiresAt
    ) external onlyAdmin {
        if (!products[productId].exists) revert ProductNotFound(productId);

        certificates[certificateId] = Certificate({
            certificateId: certificateId,
            productId:     productId,
            issuingBody:   issuingBody,
            issuedAt:      block.timestamp,
            expiresAt:     expiresAt,
            isValid:       true
        });

        products[productId].isHalalCertified = true;
        products[productId].certificateId    = certificateId;

        emit CertificateIssued(productId, certificateId, issuingBody, expiresAt);
    }

    function revokeCertificate(bytes32 certificateId) external onlyAdmin {
        Certificate storage cert = certificates[certificateId];
        if (cert.certificateId == bytes32(0)) revert CertificateNotFound(certificateId);

        cert.isValid = false;
        products[cert.productId].isHalalCertified = false;

        emit CertificateRevoked(certificateId, cert.productId, block.timestamp);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function getProduct(bytes32 productId) external view returns (Product memory) {
        if (!products[productId].exists) revert ProductNotFound(productId);
        return products[productId];
    }

    function getCertificate(bytes32 certificateId) external view returns (Certificate memory) {
        return certificates[certificateId];
    }

    function isHalalCertified(bytes32 productId) external view returns (bool) {
        if (!products[productId].exists) return false;
        Product storage p = products[productId];
        if (!p.isHalalCertified) return false;
        // Also check expiry
        Certificate storage cert = certificates[p.certificateId];
        return cert.isValid && cert.expiresAt > block.timestamp;
    }

    function getAllProductIds() external view returns (bytes32[] memory) {
        return _productIds;
    }

    function getProductCount() external view returns (uint256) {
        return _productIds.length;
    }
}

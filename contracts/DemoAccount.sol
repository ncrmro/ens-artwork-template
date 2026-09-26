// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// A separate demo participant controlled by the seed administrator.
/// These are not represented as independently operated human wallets.
contract DemoAccount {
    address public immutable admin;
    event ContractCreated(address indexed deployed);
    constructor(address admin_) { require(admin_ != address(0), "Admin required"); admin = admin_; }
    modifier onlyAdmin() { require(msg.sender == admin, "Only admin"); _; }
    function deploy(bytes memory initCode) external onlyAdmin returns(address deployed) {
        assembly ("memory-safe") { deployed := create(0, add(initCode, 32), mload(initCode)) }
        require(deployed != address(0), "Deployment failed");
        emit ContractCreated(deployed);
    }
    function execute(address target, bytes calldata data) external onlyAdmin returns(bytes memory result) {
        bool success;
        (success, result) = target.call(data);
        if (!success) { assembly ("memory-safe") { revert(add(result, 32), mload(result)) } }
    }
    function onERC1155Received(address,address,uint256,uint256,bytes calldata) external pure returns(bytes4) { return this.onERC1155Received.selector; }
    function onERC1155BatchReceived(address,address,uint256[] calldata,uint256[] calldata,bytes calldata) external pure returns(bytes4) { return this.onERC1155BatchReceived.selector; }
}

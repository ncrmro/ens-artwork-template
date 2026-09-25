// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
contract TestLabelStore { function setLabel(string calldata) external {} }
contract TestParent {
    address public child;
    address public owner=msg.sender;
    function findOwner(string calldata) external view returns(address){return owner;}
    function setSubregistry(uint256,address c) external {require(msg.sender==owner);child=c;}
    uint64 public expiry=type(uint64).max;
    function setChild(address c) external { child=c; }
    function setExpiry(uint64 x) external { expiry=x; }
    function getSubregistry(string calldata) external view returns(address){return child;}
    function findExpiry(string calldata) external view returns(uint64){return expiry;}
}

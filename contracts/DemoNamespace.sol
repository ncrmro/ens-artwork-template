// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {PermissionedRegistry} from "../vendor/ens-v2/src/registry/PermissionedRegistry.sol";
import {IRegistry} from "../vendor/ens-v2/src/registry/interfaces/IRegistry.sol";
import {ILabelStore} from "../vendor/ens-v2/src/utils/interfaces/ILabelStore.sol";

/// Demo-only ENS namespace and public discovery index, linked under the admin name.
contract DemoNamespace is PermissionedRegistry {
    address public immutable admin;
    string public catalogue;
    event CataloguePublished(bytes32 indexed digest);
    constructor(ILabelStore store,IRegistry parent,address admin_)
        PermissionedRegistry(store,admin_,0) {
        require(admin_!=address(0),"Admin required");
        admin=admin_; _parentRegistry=parent; _childLabel="ncrmro";
    }
    function attachParticipant(string calldata label,address actor,IRegistry child) external {
        require(msg.sender==admin,"Only admin");
        bytes32 h=keccak256(bytes(label));
        bytes memory b=bytes(label);
        require(b.length>0&&b.length<=63,"Invalid label");
        for(uint256 i;i<b.length;++i) require((b[i]>=0x61&&b[i]<=0x7a)||(b[i]>=0x30&&b[i]<=0x39)||(b[i]==0x2d&&i>0&&i+1<b.length),"Invalid label");
        require(address(getSubregistry(label))==address(0),"Already attached");
        (IRegistry parent,string memory childLabel)=child.getParent();
        require(address(parent)==address(this)&&keccak256(bytes(childLabel))==h,"Wrong namespace");
        _register(label,actor,child,address(0),0,type(uint64).max,false);
    }
    function publishCatalogue(string calldata value) external {
        require(msg.sender==admin,"Only admin");
        require(bytes(value).length>0&&bytes(value).length<=8192,"Invalid index size");
        catalogue=value; emit CataloguePublished(keccak256(bytes(value)));
    }
    function register(string memory,address,IRegistry,address,uint256,uint64) public pure override returns(uint256) { revert("Use attachParticipant"); }
}

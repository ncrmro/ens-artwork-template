// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {EnhancedAccessControl} from "../vendor/ens-v2/src/access-control/EnhancedAccessControl.sol";
import {ArtworkRegistry} from "./LifecycleRegistry.sol";

/// Application-level EAC. Galleries never receive ENS token-level transfer permissions.
contract MandateRegistry is EnhancedAccessControl {
    uint256 public constant ROLE_LIST = 1;
    uint256 public constant ROLE_EXHIBIT = 1 << 4;
    uint256 public constant ROLE_SELL = 1 << 8;
    struct Mandate {
        uint256 tokenId; uint256 epoch; address owner; address gallery;
        uint256 minPrice; uint96 commissionBps; uint64 expires; uint256 roles;
        bool accepted; bool revoked;
    }
    ArtworkRegistry public immutable artwork;
    uint256 public count;
    mapping(uint256 => Mandate) private mandates;
    event MandateCreated(uint256 indexed id,uint256 indexed tokenId,address indexed gallery,address owner);
    event MandateAccepted(uint256 indexed id,address indexed gallery);
    event MandateRevoked(uint256 indexed id);
    constructor(ArtworkRegistry artwork_) { artwork=artwork_; }
    function create(uint256 tokenId,address gallery,uint256 minPrice,uint96 commissionBps,uint64 expires,uint256 roles) external returns(uint256 id) {
        require(artwork.ownerOf(tokenId)==msg.sender,"Only current owner");
        require(gallery!=address(0) && gallery!=msg.sender,"Independent gallery required");
        require(expires>block.timestamp && roles!=0 && roles & ~(ROLE_LIST|ROLE_EXHIBIT|ROLE_SELL)==0,"Invalid scope or expiry");
        ArtworkRegistry.Genesis memory g=artwork.genesis(tokenId);
        require(uint256(commissionBps)+g.royaltyBps<=10000,"Fees exceed price");
        if(roles & (ROLE_LIST|ROLE_SELL)!=0) require(minPrice>0,"Minimum price required");
        id=++count;
        mandates[id]=Mandate(tokenId,artwork.ownershipEpoch(tokenId),msg.sender,gallery,minPrice,commissionBps,expires,roles,false,false);
        _grantRoles(id,roles,gallery,false);
        emit MandateCreated(id,tokenId,gallery,msg.sender);
    }
    function get(uint256 id) external view returns(Mandate memory) { return mandates[id]; }
    function accept(uint256 id) external {
        Mandate storage m=mandates[id];
        require(msg.sender==m.gallery && !m.revoked && !m.accepted && m.expires>block.timestamp,"Cannot accept");
        require(artwork.ownerOf(m.tokenId)==m.owner && artwork.ownershipEpoch(m.tokenId)==m.epoch,"Stale mandate");
        m.accepted=true; emit MandateAccepted(id,msg.sender);
    }
    function revoke(uint256 id) external {
        Mandate storage m=mandates[id];
        require(msg.sender==artwork.getOwner(m.tokenId),"Only current owner");
        m.revoked=true; _revokeRoles(id,m.roles,m.gallery,false); emit MandateRevoked(id);
    }
    function active(uint256 id,uint256 roles) public view returns(bool) {
        Mandate storage m=mandates[id];
        return roles!=0 && m.accepted && !m.revoked && m.expires>block.timestamp &&
            artwork.ownerOf(m.tokenId)==m.owner && artwork.ownershipEpoch(m.tokenId)==m.epoch &&
            hasRoles(id,roles,m.gallery);
    }
}
